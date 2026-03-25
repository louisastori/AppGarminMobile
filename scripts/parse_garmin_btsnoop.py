#!/usr/bin/env python3
from __future__ import annotations

import argparse
import collections
import datetime as dt
import io
import pathlib
import re
import struct
import sys
import zipfile
from dataclasses import dataclass
from typing import Any, Iterable

BTSNOOP_HEADER = b"btsnoop\x00"
BTSNOOP_EPOCH_DELTA_US = 0x00DCDDB30F2F8000
BUGREPORT_BTSNOOP_PATH = "FS/data/misc/bluetooth/logs/btsnoop_hci.log"
PRINTABLE_RE = re.compile(rb"[ -~]{4,}")


@dataclass(frozen=True)
class Record:
    index: int
    timestamp: dt.datetime
    flags: int
    data: bytes


@dataclass(frozen=True)
class ConnectionEvent:
    timestamp: dt.datetime
    handle: int
    address: str
    address_type: int


@dataclass(frozen=True)
class AttFrame:
    timestamp: dt.datetime
    direction: str
    att_opcode: int
    attribute_handle: int | None
    body: bytes
    raw_att: bytes


@dataclass(frozen=True)
class GarminFrame:
    timestamp: dt.datetime
    direction: str
    att_opcode: int
    attribute_handle: int
    message_id: int | None
    body: bytes
    raw_att: bytes


@dataclass(frozen=True)
class ProtoField:
    number: int
    wire_type: int
    value: Any


@dataclass(frozen=True)
class ProtoCandidate:
    name: str
    score: int
    offset: int
    fields: tuple[ProtoField, ...]
    note: str


@dataclass(frozen=True)
class ProtoMatch:
    timestamp: dt.datetime
    direction: str
    att_opcode: int
    attribute_handle: int
    message_id: int | None
    signature: str
    score: int
    offset: int
    note: str
    fields: tuple[ProtoField, ...]
    payload_preview: bytes


ATT_OPCODE_NAMES = {
    0x01: "ErrorRsp",
    0x02: "ExchangeMTUReq",
    0x03: "ExchangeMTURsp",
    0x08: "ReadByTypeReq",
    0x09: "ReadByTypeRsp",
    0x0A: "ReadReq",
    0x0B: "ReadRsp",
    0x10: "ReadByGroupTypeReq",
    0x11: "ReadByGroupTypeRsp",
    0x12: "WriteReq",
    0x13: "WriteRsp",
    0x1B: "HandleValueNotif",
    0x1D: "HandleValueInd",
    0x1E: "HandleValueCfm",
    0x52: "WriteCmd",
}

ATT_CLIENT_TO_SERVER_OPS = {0x02, 0x04, 0x06, 0x08, 0x0A, 0x0C, 0x10, 0x12, 0x16, 0x18, 0x52, 0x1E}
ATT_SERVER_TO_CLIENT_OPS = {0x01, 0x03, 0x05, 0x07, 0x09, 0x0B, 0x0D, 0x11, 0x13, 0x17, 0x19, 0x1B, 0x1D}

KNOWN_GDI_SIGNATURES: dict[str, dict[int, str]] = {
    "GDIHeartRate.MeasurementNotification": {
        1: "heart_rate_bpm",
        2: "is_hr_confident",
        3: "beat_period_1_1024ths_s",
        4: "swim_interval_data",
    },
    "GDIRunning.MeasurementNotification": {
        1: "dynamics_data",
        2: "speed_distance_data",
    },
}

FOCUSED_FAMILIES = (
    ("0x0043", lambda frame: frame.message_id == 0x0043),
    ("0x49xx", lambda frame: frame.message_id is not None and (frame.message_id & 0x00FF) == 0x49),
    ("0xA4xx", lambda frame: frame.message_id is not None and (frame.message_id & 0x00FF) == 0xA4),
)

PROTO_TAG_START_BYTES = {0x08, 0x0A, 0x10, 0x12, 0x18, 0x1A, 0x20, 0x22}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Decode Garmin BLE traffic from a btsnoop_hci.log or Android bugreport ZIP."
    )
    parser.add_argument("source", help="Path to btsnoop_hci.log or bugreport ZIP.")
    parser.add_argument(
        "--device",
        default="A0:28:84:12:B9:02",
        help="Remote BLE MAC address to inspect. Default: %(default)s",
    )
    parser.add_argument(
        "--conn-handle",
        type=lambda value: int(value, 0),
        default=None,
        help="Override the HCI connection handle instead of auto-detecting it.",
    )
    parser.add_argument(
        "--notify-handle",
        type=lambda value: int(value, 0),
        default=0x001D,
        help="ATT handle used for watch->phone notifications. Default: %(default)#06x",
    )
    parser.add_argument(
        "--write-handle",
        type=lambda value: int(value, 0),
        default=0x0020,
        help="ATT handle used for phone->watch write commands. Default: %(default)#06x",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=40,
        help="Maximum number of detailed frames to print. Default: %(default)s",
    )
    parser.add_argument(
        "--since",
        default=None,
        help="Only keep frames at or after this ISO timestamp, for example 2026-03-24T19:02:00+01:00",
    )
    return parser.parse_args()


def load_btsnoop_bytes(path: pathlib.Path) -> tuple[bytes, str]:
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as archive:
            if BUGREPORT_BTSNOOP_PATH not in archive.namelist():
                raise FileNotFoundError(
                    f"{BUGREPORT_BTSNOOP_PATH} not found inside {path}"
                )
            return archive.read(BUGREPORT_BTSNOOP_PATH), BUGREPORT_BTSNOOP_PATH
    return path.read_bytes(), str(path)


def iter_records(raw: bytes) -> Iterable[Record]:
    stream = io.BytesIO(raw)
    header = stream.read(16)
    if len(header) < 16 or not header.startswith(BTSNOOP_HEADER):
        raise ValueError("Unsupported btsnoop header.")

    index = 0
    while True:
        record_header = stream.read(24)
        if not record_header:
            return
        if len(record_header) < 24:
            raise ValueError("Truncated btsnoop record header.")
        original_length, included_length, flags, _drops, timestamp_us = struct.unpack(
            ">IIIIq", record_header
        )
        payload = stream.read(included_length)
        if len(payload) < included_length:
            raise ValueError("Truncated btsnoop record payload.")
        if original_length != included_length:
            payload = payload[:included_length]
        unix_us = timestamp_us - BTSNOOP_EPOCH_DELTA_US
        timestamp = dt.datetime.fromtimestamp(unix_us / 1_000_000, tz=dt.UTC)
        yield Record(index=index, timestamp=timestamp, flags=flags, data=payload)
        index += 1


def format_timestamp(timestamp: dt.datetime) -> str:
    return timestamp.astimezone().isoformat(timespec="milliseconds")


def format_mac_le(raw_mac: bytes) -> str:
    return ":".join(f"{byte:02X}" for byte in raw_mac[::-1])


def parse_connection_event(record: Record) -> ConnectionEvent | None:
    data = record.data
    if len(data) < 5 or data[0] != 0x04 or data[1] != 0x3E:
        return None

    subevent = data[3]
    if subevent == 0x01 and len(data) >= 15:
        status = data[4]
        if status != 0:
            return None
        handle = int.from_bytes(data[5:7], "little") & 0x0FFF
        address_type = data[8]
        address = format_mac_le(data[9:15])
        return ConnectionEvent(record.timestamp, handle, address, address_type)

    if subevent == 0x0A and len(data) >= 27:
        status = data[4]
        if status != 0:
            return None
        handle = int.from_bytes(data[5:7], "little") & 0x0FFF
        address_type = data[8]
        address = format_mac_le(data[9:15])
        return ConnectionEvent(record.timestamp, handle, address, address_type)

    return None


def att_direction_from_opcode(opcode: int) -> str:
    if opcode in ATT_SERVER_TO_CLIENT_OPS:
        return "server->client"
    if opcode in ATT_CLIENT_TO_SERVER_OPS:
        return "client->server"
    return "unknown"


def extract_attribute_handle(opcode: int, att: bytes) -> int | None:
    if len(att) < 3:
        return None
    if opcode in {0x0A, 0x12, 0x52, 0x1B, 0x1D}:
        return int.from_bytes(att[1:3], "little")
    if opcode == 0x01 and len(att) >= 5:
        return int.from_bytes(att[2:4], "little")
    return None


def parse_generic_att_frame(record: Record, conn_handle: int) -> AttFrame | None:
    data = record.data
    if len(data) < 10 or data[0] != 0x02:
        return None

    acl_handle = int.from_bytes(data[1:3], "little") & 0x0FFF
    if acl_handle != conn_handle:
        return None

    l2cap_length = int.from_bytes(data[5:7], "little")
    cid = int.from_bytes(data[7:9], "little")
    if cid != 0x0004:
        return None

    att = data[9 : 9 + l2cap_length]
    if len(att) < 3:
        return None

    opcode = att[0]
    return AttFrame(
        timestamp=record.timestamp,
        direction=att_direction_from_opcode(opcode),
        att_opcode=opcode,
        attribute_handle=extract_attribute_handle(opcode, att),
        body=att[3:],
        raw_att=att,
    )


def garmin_direction(att_frame: AttFrame) -> str:
    if att_frame.direction == "server->client":
        return "watch->phone"
    if att_frame.direction == "client->server":
        return "phone->watch"
    return att_frame.direction


def garmin_frame_from_att_frame(
    att_frame: AttFrame,
    notify_handle: int,
    write_handle: int,
) -> GarminFrame | None:
    if att_frame.attribute_handle is None:
        return None
    if att_frame.attribute_handle not in {notify_handle, write_handle}:
        return None
    if att_frame.att_opcode not in {0x1B, 0x52}:
        return None
    if len(att_frame.body) < 2:
        return None

    message_id = int.from_bytes(att_frame.body[:2], "little")
    return GarminFrame(
        timestamp=att_frame.timestamp,
        direction=garmin_direction(att_frame),
        att_opcode=att_frame.att_opcode,
        attribute_handle=att_frame.attribute_handle,
        message_id=message_id,
        body=att_frame.body[2:],
        raw_att=att_frame.raw_att,
    )


def parse_att_frame(
    record: Record,
    conn_handle: int,
    notify_handle: int,
    write_handle: int,
) -> GarminFrame | None:
    att_frame = parse_generic_att_frame(record, conn_handle)
    if att_frame is None:
        return None
    return garmin_frame_from_att_frame(att_frame, notify_handle, write_handle)


def ascii_chunks(payload: bytes) -> list[str]:
    chunks = []
    for match in PRINTABLE_RE.finditer(payload):
        text = match.group().decode("ascii", errors="ignore").strip()
        if text:
            chunks.append(text)
    return chunks


def decode_words(payload: bytes) -> str | None:
    if not payload or len(payload) > 8 or len(payload) % 2:
        return None
    unsigned = [int.from_bytes(payload[index : index + 2], "little") for index in range(0, len(payload), 2)]
    signed = [value if value < 0x8000 else value - 0x10000 for value in unsigned]
    return f"u16={unsigned} s16={signed}"


def short_hex(payload: bytes, limit: int = 48) -> str:
    if len(payload) <= limit:
        return payload.hex()
    return payload[:limit].hex() + "..."


def printable_ratio(payload: bytes) -> float:
    if not payload:
        return 0.0
    printable = sum(1 for byte in payload if byte in (9, 10, 13) or 32 <= byte <= 126)
    return printable / len(payload)


def read_varint(payload: bytes, offset: int) -> tuple[int, int] | None:
    value = 0
    shift = 0
    cursor = offset
    while cursor < len(payload) and shift < 70:
        byte = payload[cursor]
        value |= (byte & 0x7F) << shift
        cursor += 1
        if not byte & 0x80:
            return value, cursor
        shift += 7
    return None


def parse_proto_prefix(
    payload: bytes,
    *,
    max_fields: int = 12,
    max_bytes: int = 128,
) -> tuple[tuple[ProtoField, ...], int] | None:
    fields: list[ProtoField] = []
    cursor = 0
    end = min(len(payload), max_bytes)

    while cursor < end and len(fields) < max_fields:
        tag_info = read_varint(payload[:end], cursor)
        if tag_info is None:
            break
        tag, cursor = tag_info
        field_number = tag >> 3
        wire_type = tag & 0x07
        if field_number == 0:
            break

        if wire_type == 0:
            value_info = read_varint(payload[:end], cursor)
            if value_info is None:
                break
            value, cursor = value_info
            fields.append(ProtoField(field_number, wire_type, value))
            continue

        if wire_type == 1:
            if cursor + 8 > end:
                break
            value = payload[cursor : cursor + 8]
            cursor += 8
            fields.append(ProtoField(field_number, wire_type, value))
            continue

        if wire_type == 2:
            length_info = read_varint(payload[:end], cursor)
            if length_info is None:
                break
            length, cursor = length_info
            if length < 0 or cursor + length > end:
                break
            value = payload[cursor : cursor + length]
            cursor += length
            fields.append(ProtoField(field_number, wire_type, value))
            continue

        if wire_type == 5:
            if cursor + 4 > end:
                break
            value = payload[cursor : cursor + 4]
            cursor += 4
            fields.append(ProtoField(field_number, wire_type, value))
            continue

        break

    if not fields or cursor == 0:
        return None
    return tuple(fields), cursor


def field_summary(field: ProtoField) -> str:
    if field.wire_type == 0:
        return f"{field.number}={field.value}"
    if field.wire_type == 2:
        ascii_note = ascii_chunks(field.value[:48])
        if ascii_note:
            return f"{field.number}:len={len(field.value)}:{ascii_note[0]!r}"
        return f"{field.number}:len={len(field.value)}"
    return f"{field.number}:wire={field.wire_type}"


def scan_proto_candidates(payload: bytes) -> list[tuple[int, tuple[ProtoField, ...], int]]:
    if len(payload) < 2 or printable_ratio(payload) > 0.70:
        return []

    candidates: list[tuple[int, tuple[ProtoField, ...], int]] = []
    seen: set[tuple[int, tuple[tuple[int, int], ...], int]] = set()
    for offset in range(min(len(payload), 24)):
        if payload[offset] not in PROTO_TAG_START_BYTES:
            continue
        parsed = parse_proto_prefix(payload[offset:])
        if parsed is None:
            continue
        fields, consumed = parsed
        if consumed < 3:
            continue
        key = (offset, tuple((field.number, field.wire_type) for field in fields[:6]), consumed)
        if key in seen:
            continue
        seen.add(key)
        candidates.append((offset, fields, consumed))
    return candidates


def nested_proto_note(payload: bytes) -> str | None:
    parsed = parse_proto_prefix(payload, max_fields=8, max_bytes=64)
    if parsed is None:
        return None
    fields, _consumed = parsed
    if not fields:
        return None
    preview = ", ".join(field_summary(field) for field in fields[:4])
    return preview


def score_gdi_heart_rate(fields: tuple[ProtoField, ...]) -> tuple[int, str]:
    by_number = {field.number: field for field in fields}
    field1 = by_number.get(1)
    if field1 is None or field1.wire_type != 0:
        return 0, ""

    score = 0
    notes: list[str] = []
    if 30 <= field1.value <= 255:
        score += 3
        notes.append(f"heart_rate_bpm={field1.value}")
        if 40 <= field1.value <= 230:
            score += 2

    field2 = by_number.get(2)
    if field2 is not None and field2.wire_type == 0 and field2.value in {0, 1}:
        score += 3
        notes.append(f"is_hr_confident={field2.value}")

    field3 = by_number.get(3)
    if field3 is not None and field3.wire_type == 0 and 200 <= field3.value <= 3000:
        score += 4
        notes.append(f"beat_period_1_1024ths_s={field3.value}")

    field4 = by_number.get(4)
    if field4 is not None and field4.wire_type == 2:
        score += 1
        notes.append(f"swim_interval_data_len={len(field4.value)}")

    return score, ", ".join(notes)


def score_gdi_running(fields: tuple[ProtoField, ...]) -> tuple[int, str]:
    score = 0
    notes: list[str] = []
    by_number = {field.number: field for field in fields}
    present_len_delimited = 0

    for field_number, label in ((1, "dynamics_data"), (2, "speed_distance_data")):
        field = by_number.get(field_number)
        if field is None or field.wire_type != 2:
            continue
        present_len_delimited += 1
        score += 2
        nested = nested_proto_note(field.value)
        if nested:
            score += 2
            notes.append(f"{label}_len={len(field.value)} [{nested}]")
        else:
            notes.append(f"{label}_len={len(field.value)}")

    if present_len_delimited == 2:
        score += 2

    return score, ", ".join(notes)


def candidate_payloads(
    att_frame: AttFrame,
    notify_handle: int,
    write_handle: int,
) -> list[tuple[str, bytes, int | None]]:
    payloads = [("att-body", att_frame.body, None)]
    if att_frame.attribute_handle in {notify_handle, write_handle} and len(att_frame.body) >= 2:
        payloads.insert(
            0,
            (
                "garmin-body",
                att_frame.body[2:],
                int.from_bytes(att_frame.body[:2], "little"),
            ),
        )
    return payloads


def detect_gdi_matches(
    att_frames: list[AttFrame],
    notify_handle: int,
    write_handle: int,
) -> dict[str, list[ProtoMatch]]:
    matches: dict[str, list[ProtoMatch]] = {name: [] for name in KNOWN_GDI_SIGNATURES}

    for att_frame in att_frames:
        if att_frame.attribute_handle is None:
            continue
        for _label, payload, message_id in candidate_payloads(att_frame, notify_handle, write_handle):
            for offset, fields, consumed in scan_proto_candidates(payload):
                for signature in KNOWN_GDI_SIGNATURES:
                    if signature.startswith("GDIHeartRate"):
                        score, note = score_gdi_heart_rate(fields)
                    else:
                        score, note = score_gdi_running(fields)
                    if score <= 0:
                        continue
                    matches[signature].append(
                        ProtoMatch(
                            timestamp=att_frame.timestamp,
                            direction=garmin_direction(att_frame),
                            att_opcode=att_frame.att_opcode,
                            attribute_handle=att_frame.attribute_handle,
                            message_id=message_id,
                            signature=signature,
                            score=score,
                            offset=offset,
                            note=note,
                            fields=fields,
                            payload_preview=payload[offset : offset + min(consumed, 32)],
                        )
                    )

    for signature, signature_matches in matches.items():
        signature_matches.sort(
            key=lambda match: (
                -match.score,
                match.message_id is None,
                match.timestamp,
                match.attribute_handle,
                match.offset,
            )
        )
        deduped: list[ProtoMatch] = []
        seen: set[tuple[dt.datetime, int, str, tuple[str, ...]]] = set()
        for match in signature_matches:
            key = (
                match.timestamp,
                match.attribute_handle,
                match.note,
                tuple(field_summary(field) for field in match.fields[:4]),
            )
            if key in seen:
                continue
            seen.add(key)
            deduped.append(match)
        matches[signature] = deduped

    return matches


def burst_frames(frames: list[GarminFrame], max_gap_seconds: float = 1.5) -> list[list[GarminFrame]]:
    if not frames:
        return []

    bursts: list[list[GarminFrame]] = [[frames[0]]]
    for frame in frames[1:]:
        previous = bursts[-1][-1]
        gap = (frame.timestamp - previous.timestamp).total_seconds()
        if gap > max_gap_seconds:
            bursts.append([frame])
            continue
        bursts[-1].append(frame)
    return bursts


def joined_ascii_preview(frames: list[GarminFrame]) -> str | None:
    payload = b"".join(frame.body for frame in frames if frame.body)
    strings = ascii_chunks(payload)
    if not strings:
        return None
    return " | ".join(strings[:3])


def print_focused_family_reports(frames: list[GarminFrame]) -> None:
    print("Focused message families:")
    for label, matcher in FOCUSED_FAMILIES:
        family_frames = [frame for frame in frames if matcher(frame)]
        print(f"  {label}:")
        if not family_frames:
            print("    none")
            continue

        print(
            f"    count={len(family_frames)} first={format_timestamp(family_frames[0].timestamp)} "
            f"last={format_timestamp(family_frames[-1].timestamp)}"
        )

        by_message = collections.Counter(frame.message_id for frame in family_frames)
        top_ids = ", ".join(
            f"0x{message_id:04X} x{count}" for message_id, count in by_message.most_common(8)
        )
        print(f"    top_ids={top_ids}")

        if label == "0x0043":
            values = [frame.body[0] for frame in family_frames if len(frame.body) == 1]
            intervals = [
                (family_frames[index].timestamp - family_frames[index - 1].timestamp).total_seconds()
                for index in range(1, len(family_frames))
            ]
            if values:
                print(
                    f"    values={values[:20]}{' ...' if len(values) > 20 else ''} "
                    f"range=0x{min(values):02X}->0x{max(values):02X}"
                )
            if intervals:
                average = sum(intervals) / len(intervals)
                print(
                    f"    interval_seconds min={min(intervals):.3f} avg={average:.3f} max={max(intervals):.3f}"
                )
            continue

        non_empty = [frame for frame in family_frames if frame.body]
        if non_empty:
            sample_frames = non_empty[:4]
            for frame in sample_frames:
                details = joined_ascii_preview([frame]) or decode_words(frame.body) or short_hex(frame.body, 96)
                print(
                    f"    sample {format_timestamp(frame.timestamp)} {frame.direction:12} "
                    f"msg=0x{frame.message_id:04X} len={len(frame.body)} {details}"
                )

        bursts = burst_frames(family_frames)
        for index, burst in enumerate(bursts[:8], start=1):
            directions = ",".join(sorted({frame.direction for frame in burst}))
            ids = f"0x{burst[0].message_id:04X}->0x{burst[-1].message_id:04X}"
            ascii_preview = joined_ascii_preview(burst)
            total_bytes = sum(len(frame.body) for frame in burst)
            extra = ascii_preview or short_hex(b"".join(frame.body for frame in burst if frame.body), 96)
            print(
                f"    burst#{index} {format_timestamp(burst[0].timestamp)} -> {format_timestamp(burst[-1].timestamp)} "
                f"frames={len(burst)} bytes={total_bytes} ids={ids} directions={directions}"
            )
            if extra:
                print(f"      preview={extra}")


def print_connection_summary(events: list[ConnectionEvent], target_address: str) -> None:
    print("Connections detected:")
    if not events:
        print("  none")
        return
    for event in events:
        marker = " <target>" if event.address.upper() == target_address.upper() else ""
        print(
            f"  {format_timestamp(event.timestamp)} handle=0x{event.handle:04X} "
            f"address={event.address} type={event.address_type}{marker}"
        )


def print_att_handle_summary(att_frames: list[AttFrame]) -> None:
    print("All ATT traffic on selected connection:")
    if not att_frames:
        print("  none")
        return

    by_opcode = collections.Counter((frame.direction, frame.att_opcode) for frame in att_frames)
    for (direction, opcode), count in by_opcode.most_common(12):
        opcode_name = ATT_OPCODE_NAMES.get(opcode, f"0x{opcode:02X}")
        print(f"  {direction:14} {opcode_name:16} count={count}")

    handle_frames = [frame for frame in att_frames if frame.attribute_handle is not None]
    if not handle_frames:
        return

    print("Handle-based ATT operations:")
    by_triplet = collections.Counter(
        (frame.direction, frame.att_opcode, frame.attribute_handle) for frame in handle_frames
    )
    for (direction, opcode, attribute_handle), count in by_triplet.most_common(12):
        opcode_name = ATT_OPCODE_NAMES.get(opcode, f"0x{opcode:02X}")
        print(f"  {direction:14} {opcode_name:16} att=0x{attribute_handle:04X} count={count}")

    by_handle = collections.Counter(frame.attribute_handle for frame in handle_frames)
    print("Top handles:")
    for attribute_handle, count in by_handle.most_common(10):
        print(f"  att=0x{attribute_handle:04X} count={count}")

    notify_like = collections.Counter(
        frame.attribute_handle for frame in handle_frames if frame.att_opcode in {0x1B, 0x1D}
    )
    if notify_like:
        print("Notification/indication handles:")
        for attribute_handle, count in notify_like.most_common(8):
            print(f"  att=0x{attribute_handle:04X} count={count}")


def pick_connection_handle(
    events: list[ConnectionEvent],
    requested_handle: int | None,
    target_address: str,
) -> int:
    if requested_handle is not None:
        return requested_handle

    matching = [event for event in events if event.address.upper() == target_address.upper()]
    if not matching:
        raise SystemExit(f"No LE connection event found for {target_address}.")
    return matching[-1].handle


def print_frame_stats(frames: list[GarminFrame]) -> None:
    if not frames:
        print("No 0x001d / 0x0020 ATT frames found on the selected connection.")
        return

    by_direction = collections.Counter(frame.direction for frame in frames)
    by_message = collections.Counter(
        (frame.direction, frame.message_id) for frame in frames if frame.message_id is not None
    )

    print("ATT stream summary:")
    for direction, count in by_direction.items():
        print(f"  {direction}: {count} frames")

    print("Top message ids:")
    for (direction, message_id), count in by_message.most_common(12):
        print(f"  {direction:12} msg=0x{message_id:04X} count={count}")

    repeated_small = []
    for (direction, message_id), count in by_message.items():
        matching = [
            frame for frame in frames if frame.direction == direction and frame.message_id == message_id
        ]
        if count < 2:
            continue
        if not matching or len(matching[0].body) == 0 or len(matching[0].body) > 8:
            continue
        unique_payloads = sorted({frame.body.hex() for frame in matching})
        repeated_small.append((direction, message_id, count, unique_payloads[:6]))

    if repeated_small:
        print("Repeated small payloads:")
        for direction, message_id, count, samples in sorted(
            repeated_small, key=lambda item: (-item[2], item[0], item[1])
        )[:12]:
            decoded = []
            for sample in samples:
                sample_bytes = bytes.fromhex(sample)
                words = decode_words(sample_bytes)
                decoded.append(f"{sample} ({words or 'raw'})")
            print(f"  {direction:12} msg=0x{message_id:04X} count={count} samples={'; '.join(decoded)}")


def print_known_gdi_signatures() -> None:
    print("Known GDI signatures from Garmin Connect APK:")
    for signature, fields in KNOWN_GDI_SIGNATURES.items():
        rendered = ", ".join(f"{number}={label}" for number, label in fields.items())
        print(f"  {signature}: {rendered}")


def print_gdi_candidate_report(
    att_frames: list[AttFrame],
    notify_handle: int,
    write_handle: int,
    limit: int,
) -> None:
    matches = detect_gdi_matches(att_frames, notify_handle, write_handle)
    thresholds = {
        "GDIHeartRate.MeasurementNotification": 7,
        "GDIRunning.MeasurementNotification": 6,
    }

    print("GDI candidate scan:")
    for signature, signature_matches in matches.items():
        strong = [match for match in signature_matches if match.score >= thresholds[signature]]
        weak = [match for match in signature_matches if match.score < thresholds[signature]]
        print(f"  {signature}:")
        print(
            f"    total_matches={len(signature_matches)} strong={len(strong)} weak={len(weak)}"
        )
        if not strong:
            print("    no confident decode found in this capture")
        for match in strong[:limit]:
            opcode_name = ATT_OPCODE_NAMES.get(match.att_opcode, f"0x{match.att_opcode:02X}")
            msg = f" msg=0x{match.message_id:04X}" if match.message_id is not None else ""
            fields = ", ".join(field_summary(field) for field in match.fields[:4])
            print(
                f"    {format_timestamp(match.timestamp)} {match.direction:12} {opcode_name:16} "
                f"att=0x{match.attribute_handle:04X}{msg} score={match.score} offset={match.offset}"
            )
            print(f"      note={match.note or 'n/a'}")
            print(f"      fields={fields}")

        if strong:
            continue

        for match in weak[: min(limit, 4)]:
            opcode_name = ATT_OPCODE_NAMES.get(match.att_opcode, f"0x{match.att_opcode:02X}")
            msg = f" msg=0x{match.message_id:04X}" if match.message_id is not None else ""
            fields = ", ".join(field_summary(field) for field in match.fields[:4])
            print(
                f"    weak {format_timestamp(match.timestamp)} {match.direction:12} {opcode_name:16} "
                f"att=0x{match.attribute_handle:04X}{msg} score={match.score} offset={match.offset}"
            )
            print(f"      note={match.note or 'n/a'}")
            print(f"      fields={fields}")


def print_interesting_frames(frames: list[GarminFrame], limit: int) -> None:
    interesting: list[tuple[GarminFrame, list[str], str | None]] = []
    for frame in frames:
        strings = ascii_chunks(frame.body)
        numeric = decode_words(frame.body)
        if strings or numeric or len(frame.body) >= 24:
            interesting.append((frame, strings, numeric))

    print(f"Interesting frames (up to {limit}):")
    if not interesting:
        print("  none")
        return

    for frame, strings, numeric in interesting[:limit]:
        details = []
        if strings:
            details.append("ascii=" + " | ".join(strings[:3]))
        if numeric:
            details.append(numeric)
        if not details:
            details.append("hex=" + short_hex(frame.body))
        print(
            f"  {format_timestamp(frame.timestamp)} {frame.direction:12} "
            f"msg=0x{frame.message_id:04X} len={len(frame.body):3d} "
            f"{'; '.join(details)}"
        )


def print_frame_dump(frames: list[GarminFrame], limit: int) -> None:
    print(f"Frame dump (up to {limit}):")
    if not frames:
        print("  none")
        return
    for frame in frames[:limit]:
        opcode_name = ATT_OPCODE_NAMES.get(frame.att_opcode, f"0x{frame.att_opcode:02X}")
        print(
            f"  {format_timestamp(frame.timestamp)} {frame.direction:12} "
            f"{opcode_name:16} att=0x{frame.attribute_handle:04X} "
            f"msg=0x{frame.message_id:04X} body={short_hex(frame.body)}"
        )


def main() -> int:
    args = parse_args()
    source_path = pathlib.Path(args.source)
    raw, inner_path = load_btsnoop_bytes(source_path)
    records = list(iter_records(raw))
    connection_events = [event for record in records if (event := parse_connection_event(record)) is not None]

    print(f"Source: {source_path}")
    print(f"Decoded stream: {inner_path}")
    print_connection_summary(connection_events, args.device)

    conn_handle = pick_connection_handle(connection_events, args.conn_handle, args.device)
    print(f"Selected connection handle: 0x{conn_handle:04X}")
    print(f"Target ATT handles: notify=0x{args.notify_handle:04X} write=0x{args.write_handle:04X}")

    since_timestamp = None
    if args.since:
        since_timestamp = dt.datetime.fromisoformat(args.since)
        if since_timestamp.tzinfo is None:
            since_timestamp = since_timestamp.astimezone()
        since_timestamp = since_timestamp.astimezone(dt.UTC)
        print(f"Frame filter since: {format_timestamp(since_timestamp)}")

    att_frames = [
        frame
        for record in records
        if (frame := parse_generic_att_frame(record, conn_handle)) is not None
        and (since_timestamp is None or frame.timestamp >= since_timestamp)
    ]

    garmin_frames = [
        frame
        for att_frame in att_frames
        if (frame := garmin_frame_from_att_frame(att_frame, args.notify_handle, args.write_handle))
        is not None
    ]

    print_att_handle_summary(att_frames)
    print_frame_stats(garmin_frames)
    print_known_gdi_signatures()
    print_gdi_candidate_report(att_frames, args.notify_handle, args.write_handle, min(args.limit, 6))
    print_focused_family_reports(garmin_frames)
    print_interesting_frames(garmin_frames, args.limit)
    print_frame_dump(garmin_frames, min(args.limit, 20))
    return 0


if __name__ == "__main__":
    sys.exit(main())
