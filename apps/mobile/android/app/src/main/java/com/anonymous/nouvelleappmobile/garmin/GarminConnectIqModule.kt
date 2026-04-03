package com.anonymous.nouvelleappmobile.garmin

import android.content.Context
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.garmin.android.connectiq.ConnectIQ
import com.garmin.android.connectiq.IQApp
import com.garmin.android.connectiq.IQDevice
import com.garmin.android.connectiq.exception.InvalidStateException
import com.garmin.android.connectiq.exception.ServiceUnavailableException
import org.json.JSONArray
import org.json.JSONObject

class GarminConnectIqModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val LOG_TAG = "GarminConnectIq"
    private const val MODULE_NAME = "GarminConnectIq"
    private const val EVENT_STATUS_CHANGED = "garminConnectIqStatusChanged"
    private const val EVENT_BATCH_RECEIVED = "garminConnectIqBatchReceived"
    private const val EVENT_DIAGNOSTIC = "garminConnectIqDiagnostic"
    private const val DEFAULT_APP_ID = "5f9c2f5c28bc4af29f725e515d13a7f0"
    private const val PREFS_NAME = "garmin_connect_iq_bridge"
    private const val PREF_STATUS_CACHE_PREFIX = "status_cache_json"
    private const val AUTO_SYNC_MODE_OFF = "off"
    private const val AUTO_SYNC_MODE_IDLE = "idle"
    private const val AUTO_SYNC_MODE_ACTIVITY = "activity"
    private const val IDLE_AUTO_SYNC_INTERVAL_MS = 30L * 60L * 1000L
    private const val ACTIVITY_AUTO_SYNC_INTERVAL_MS = 60L * 1000L
    private const val ACTIVITY_TIMER_STATE_KEY = "activity_timer_state"
  }

  private val preferences: SharedPreferences =
    reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
  private val autoSyncHandler = Handler(Looper.getMainLooper())
  private var connectIQ: ConnectIQ? = null
  private var initializationStarted = false
  private var isSdkReady = false
  private var pendingInitializePromise: Promise? = null
  private var targetAppId: String = DEFAULT_APP_ID
  private var preferredDeviceName: String = "fenix"
  private var preferredDeviceKind: String = "fenix"
  private var currentDevice: IQDevice? = null
  private var currentDeviceStatus: String = "disconnected"
  private var currentWatchDeviceId: String? = null
  private var currentWatchDeviceKind: String? = null
  private var currentWatchDeviceModel: String? = null
  private var currentWatchFirmwareVersion: String? = null
  private var currentWatchAppVersion: String? = null
  private var currentWatchTimezoneOffsetMinutes: Int? = null
  private var currentWatchLinkRecordedAt: String? = null
  private var currentWatchLinkHealth: String? = null
  private var currentWatchLinkLastErrorCode: String? = null
  private var lastBatchId: String? = null
  private var lastBatchJson: String? = null
  private var pendingBatchCount: Int = 0
  private var lastAckBatchId: String? = null
  private var lastAckSampleId: String? = null
  private var lastAckRecordedAt: String? = null
  private var lastDiagnosticCode: String? = null
  private var lastDiagnosticMessage: String? = null
  private var lastDiagnosticBatchId: String? = null
  private var lastDiagnosticRecordedAt: String? = null
  private var currentCapabilitiesSupportedMetrics: List<String> = emptyList()
  private var currentCapabilitiesSupportsBufferedSync: Boolean = false
  private var currentCapabilitiesSupportsLiveMode: Boolean = false
  private var currentCapabilitiesMaxBatchItems: Int = 0
  private var currentCapabilitiesMaxBufferedSamples: Int = 0
  private var appEventsRegistered = false
  private var initialSyncRequested = false
  private var registeredDeviceIdentifier: Long? = null
  private var autoSyncRunnable: Runnable? = null
  private var autoSyncMode: String = AUTO_SYNC_MODE_OFF
  private var autoSyncIntervalMs: Long = 0
  private var autoSyncNextAt: String? = null
  private var activityActive: Boolean = false

  private val connectIQListener =
    object : ConnectIQ.ConnectIQListener {
      override fun onInitializeError(errStatus: ConnectIQ.IQSdkErrorStatus) {
        initializationStarted = false
        isSdkReady = false
        Log.e(LOG_TAG, "onInitializeError status=${errStatus.name}")
        emitDiagnostic(
          "service_unavailable",
          "Initialisation Connect IQ echouee: ${errStatus.name}",
          null
        )
        pendingInitializePromise?.reject(
          "connect_iq_init_error",
          "Initialisation Connect IQ echouee: ${errStatus.name}"
        )
        pendingInitializePromise = null
        emitStatusChanged()
      }

      override fun onSdkReady() {
        initializationStarted = true
        isSdkReady = true
        Log.d(LOG_TAG, "onSdkReady")
        refreshDevices()
        pendingInitializePromise?.resolve(createStatusMap())
        pendingInitializePromise = null
        emitStatusChanged()
      }

      override fun onSdkShutDown() {
        initializationStarted = false
        isSdkReady = false
        stopAutoSyncInternal()
        Log.d(LOG_TAG, "onSdkShutDown")
        emitStatusChanged()
      }
    }

  override fun getName(): String = MODULE_NAME

  @ReactMethod
  fun initialize(options: ReadableMap, promise: Promise) {
    targetAppId =
      options.getString("appId")
        ?.replace("-", "")
        ?.takeIf { it.isNotBlank() }
        ?: DEFAULT_APP_ID
    preferredDeviceName =
      options.getString("preferredDeviceName")
        ?.takeIf { it.isNotBlank() }
        ?: "fenix"
    preferredDeviceKind =
      options.getString("preferredDeviceKind")
        ?.takeIf { it.isNotBlank() }
        ?: preferredDeviceName

    if (connectIQ == null) {
      connectIQ = ConnectIQ.getInstance(reactApplicationContext, ConnectIQ.IQConnectType.WIRELESS)
    }

    resetAppScopedState()
    restorePersistedState()
    initializationStarted = true

    Log.d(
      LOG_TAG,
      "initialize appId=$targetAppId preferredDeviceName=$preferredDeviceName preferredDeviceKind=$preferredDeviceKind sdkReady=$isSdkReady"
    )

    if (isSdkReady) {
      refreshDevices()
      promise.resolve(createStatusMap())
      return
    }

    pendingInitializePromise = promise

    try {
      connectIQ?.initialize(reactApplicationContext, true, connectIQListener)
    } catch (error: Exception) {
      pendingInitializePromise = null
      promise.reject("connect_iq_init_exception", error)
    }
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    promise.resolve(createStatusMap())
  }

  @ReactMethod
  fun shutdown(promise: Promise) {
    persistState()
    stopAutoSyncInternal()

    try {
      connectIQ?.unregisterAllForEvents()
      connectIQ?.shutdown(reactApplicationContext)
    } catch (_: InvalidStateException) {
    }

    initializationStarted = false
    isSdkReady = false
    appEventsRegistered = false
    initialSyncRequested = false
    currentDevice = null
    currentDeviceStatus = "disconnected"
    registeredDeviceIdentifier = null
    resetAppScopedState()
    promise.resolve(null)
  }

  @ReactMethod
  fun requestSyncNow(promise: Promise) {
    sendPayload(buildSyncRequestPayload("manual"), promise)
  }

  @ReactMethod
  fun acknowledgeBatch(payloadJson: String, promise: Promise) {
    sendPayloadJson(payloadJson, promise)
  }

  @ReactMethod
  fun sendMessage(payloadJson: String, promise: Promise) {
    sendPayloadJson(payloadJson, promise)
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for RN event emitters.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required for RN event emitters.
  }

  private fun refreshDevices() {
    if (!isSdkReady) {
      stopAutoSyncInternal()
      Log.d(LOG_TAG, "refreshDevices skipped sdkNotReady")
      emitStatusChanged()
      return
    }

    val sdk = connectIQ ?: return

    try {
      val knownDevices = sdk.knownDevices ?: emptyList()
      Log.d(LOG_TAG, "refreshDevices knownDevices=${knownDevices.size}")
      knownDevices.forEach { device ->
        device.status = sdk.getDeviceStatus(device)
        Log.d(
          LOG_TAG,
          "knownDevice id=${device.deviceIdentifier} name=${device.friendlyName ?: "unknown"} status=${device.status?.name ?: "unknown"}"
        )
      }

      currentDevice =
        knownDevices.firstOrNull { deviceMatchesPreference(it) }
          ?: knownDevices.firstOrNull {
            it.friendlyName?.contains(preferredDeviceName, ignoreCase = true) == true
          }
          ?: knownDevices.firstOrNull()
      currentDeviceStatus = currentDevice?.status?.name?.lowercase() ?: "disconnected"
      Log.d(
        LOG_TAG,
        "selectedDevice id=${currentDevice?.deviceIdentifier ?: -1} name=${currentDevice?.friendlyName ?: "none"} status=$currentDeviceStatus"
      )

      var justRegisteredDeviceEvents = false
      currentDevice?.deviceIdentifier?.let { selectedIdentifier ->
        if (registeredDeviceIdentifier != selectedIdentifier) {
          registerForDeviceEvents(currentDevice!!)
          registeredDeviceIdentifier = selectedIdentifier
          justRegisteredDeviceEvents = true
        }
      }

      if (currentDeviceStatus == "connected") {
        clearDeviceNotConnectedDiagnostic()
        registerForTargetAppEvents()
      } else if (currentDevice != null) {
        appEventsRegistered = false
        if (!justRegisteredDeviceEvents) {
          emitDeviceNotConnectedDiagnostic()
        }
        return
      }
    } catch (error: ServiceUnavailableException) {
      emitDiagnostic(
        "service_unavailable",
        "Service Connect IQ indisponible. Verifie Garmin Connect Mobile.",
        null
      )
    } catch (error: InvalidStateException) {
      emitDiagnostic("invalid_state", "Connect IQ n est pas dans un etat valide.", null)
    }

    emitStatusChanged()
  }

  private fun registerForDeviceEvents(device: IQDevice) {
    val sdk = connectIQ ?: return

    try {
      sdk.registerForDeviceEvents(device) { updatedDevice, status ->
        if (updatedDevice.deviceIdentifier != currentDevice?.deviceIdentifier) {
          Log.d(
            LOG_TAG,
            "deviceStatusChanged ignored id=${updatedDevice.deviceIdentifier} name=${updatedDevice.friendlyName ?: "unknown"} status=${status.name.lowercase()}"
          )
          return@registerForDeviceEvents
        }

        currentDevice = updatedDevice
        currentDeviceStatus = status.name.lowercase()
        Log.d(
          LOG_TAG,
          "deviceStatusChanged id=${updatedDevice.deviceIdentifier} name=${updatedDevice.friendlyName ?: "unknown"} status=$currentDeviceStatus"
        )

        if (currentDeviceStatus == "connected") {
          clearDeviceNotConnectedDiagnostic()
          registerForTargetAppEvents()
          emitStatusChanged()
        } else {
          appEventsRegistered = false
          emitDeviceNotConnectedDiagnostic()
        }
      }
    } catch (_: InvalidStateException) {
      emitDiagnostic("invalid_state", "Impossible de surveiller le device Connect IQ.", null)
    }
  }

  private fun registerForTargetAppEvents() {
    val sdk = connectIQ ?: return
    val device = currentDevice ?: run {
      emitDiagnostic("device_missing", "Aucun appareil Garmin Connect IQ connu.", null)
      return
    }
    val app = IQApp(targetAppId)
    Log.d(
      LOG_TAG,
      "registerForTargetAppEvents device=${device.friendlyName ?: "unknown"} appId=$targetAppId"
    )

    try {
      sdk.getApplicationInfo(
        targetAppId,
        device,
        object : ConnectIQ.IQApplicationInfoListener {
          override fun onApplicationInfoReceived(application: IQApp) {
            Log.d(LOG_TAG, "onApplicationInfoReceived appId=${application.applicationId}")
            currentCapabilitiesSupportedMetrics = emptyList()
            currentCapabilitiesSupportsBufferedSync = true
            currentCapabilitiesSupportsLiveMode = true
            currentCapabilitiesMaxBatchItems = 24
            currentCapabilitiesMaxBufferedSamples = 240
            registerForAppEvents(device, app)
            emitStatusChanged()
          }

          override fun onApplicationNotInstalled(applicationId: String) {
            Log.w(LOG_TAG, "onApplicationNotInstalled appId=$applicationId device=${device.friendlyName}")
            emitDiagnostic(
              "app_not_installed",
              "L application Connect IQ montre n est pas installee sur ${device.friendlyName}.",
              null
            )
          }
        }
      )
    } catch (error: ServiceUnavailableException) {
      emitDiagnostic(
        "service_unavailable",
        "Service Connect IQ indisponible. Verifie Garmin Connect Mobile.",
        null
      )
    } catch (_: InvalidStateException) {
      emitDiagnostic("invalid_state", "Impossible de verifier l app montre Connect IQ.", null)
    }
  }

  private fun registerForAppEvents(device: IQDevice, app: IQApp) {
    if (appEventsRegistered) {
      updateAutoSyncSchedule()
      return
    }

    val sdk = connectIQ ?: return

    try {
      sdk.registerForAppEvents(device, app) { _, _, message, _ ->
        Log.d(
          LOG_TAG,
          "appMessageReceived parts=${message?.size ?: 0} device=${device.friendlyName ?: "unknown"}"
        )
        handleAppMessage(message)
      }
      appEventsRegistered = true
      Log.d(LOG_TAG, "registerForAppEvents ok device=${device.friendlyName ?: "unknown"}")
      updateAutoSyncSchedule()
      requestInitialSyncIfNeeded()
    } catch (_: InvalidStateException) {
      emitDiagnostic("invalid_state", "Impossible de recevoir les messages montre.", null)
    }
  }

  private fun handleAppMessage(message: List<Any>?) {
    if (message.isNullOrEmpty()) {
      emitDiagnostic("empty_message", "Message vide recu depuis la montre.", null)
      return
    }

    val payload = extractIncomingPayload(message)
    if (payload == null) {
      emitDiagnostic(
        "batch_rejected",
        "Payload Connect IQ non JSON ou contrat non reconnu.",
        null
      )
      return
    }

    val payloadJson = payloadToJsonString(payload)
    Log.d(LOG_TAG, "handleAppMessage payload=$payloadJson")

    when (payload["messageType"] as? String) {
      "device_hello" -> {
        clearLastDiagnostic()
        handleIncomingDeviceHello(payload)
        persistState()
        emitStatusChanged()
      }
      "device_capabilities" -> {
        clearLastDiagnostic()
        handleIncomingCapabilities(payload)
        persistState()
        emitStatusChanged()
      }
      "link_status" -> {
        clearLastDiagnostic()
        handleIncomingLinkStatus(payload)
        persistState()
        emitStatusChanged()
      }
      "batch_envelope" -> {
        clearLastDiagnostic()
        lastBatchId = payload["batchId"] as? String
        lastBatchJson = payloadJson
        pendingBatchCount += 1
        activityActive = extractActivityActive(payload)
        updateAutoSyncSchedule()
        persistState()
        val batchPayload = Arguments.createMap()
        batchPayload.putString("batchJson", payloadJson)
        emitEvent(EVENT_BATCH_RECEIVED, batchPayload)
        emitStatusChanged()
      }
      "sync_diagnostic" -> {
        emitDiagnostic(
          payload["code"] as? String ?: "sync_diagnostic",
          payload["message"] as? String ?: "Diagnostic Connect IQ",
          payload["batchId"] as? String,
          payload["recordedAt"] as? String
        )
      }
      else -> {
        emitDiagnostic("unknown_message", "Message Connect IQ non reconnu.", null)
      }
    }
  }

  private fun sendPayloadJson(payloadJson: String, promise: Promise) {
    val outgoingPayload =
      try {
        parsePayloadJson(payloadJson)
      } catch (_: Exception) {
        promise.reject("connect_iq_invalid_payload", "Payload Connect IQ sortant non valide.")
        return
      }

    sendPayload(outgoingPayload, promise)
  }

  private fun sendPayload(payload: Any, promise: Promise? = null) {
    if (!isSdkReady) {
      promise?.reject("connect_iq_not_ready", "Connect IQ n est pas initialise.")
      return
    }

    val sdk = connectIQ
    val device = currentDevice
    if (sdk == null || device == null) {
      promise?.reject("connect_iq_no_device", "Aucun appareil Garmin Connect IQ disponible.")
      return
    }

    if (currentDeviceStatus != "connected") {
      emitDeviceNotConnectedDiagnostic()
      promise?.reject(
        "connect_iq_device_not_connected",
        "L appareil Garmin est connu mais n est pas connecte a Garmin Connect Mobile."
      )
      return
    }

    if (lastDiagnosticCode == "app_not_installed") {
      val deviceName = device.friendlyName ?: preferredDeviceName
      promise?.reject(
        "connect_iq_app_not_installed",
        "L application Connect IQ montre n est pas installee sur $deviceName."
      )
      return
    }

    val app = IQApp(targetAppId)
    Log.d(
      LOG_TAG,
      "sendPayload device=${device.friendlyName ?: "unknown"} payload=${payloadToDebugString(payload)}"
    )

    try {
      sdk.sendMessage(device, app, payload) { _, _, status ->
        if (status.name.contains("SUCCESS", ignoreCase = true)) {
          recordOutgoingPayload(payload)
        }
        promise?.resolve(status.name)
      }
    } catch (error: ServiceUnavailableException) {
      emitDiagnostic(
        "service_unavailable",
        "Service Connect IQ indisponible. Verifie Garmin Connect Mobile.",
        null
      )
      promise?.reject("connect_iq_service_unavailable", error)
    } catch (error: InvalidStateException) {
      emitDiagnostic("invalid_state", "Impossible d envoyer un message Connect IQ.", null)
      promise?.reject("connect_iq_invalid_state", error)
    }
  }

  private fun requestInitialSyncIfNeeded() {
    if (initialSyncRequested) {
      return
    }

    initialSyncRequested = true
    sendPayload(buildSyncRequestPayload("startup"))
  }

  private fun buildSyncRequestPayload(reason: String) = hashMapOf<String, Any?>(
    "messageType" to "sync_request",
    "requestId" to "android-${System.currentTimeMillis()}",
    "requestedAt" to java.time.Instant.now().toString(),
    "reason" to reason
  )

  private fun resolveAutoSyncMode(): String {
    if (!isSdkReady || !appEventsRegistered || currentDeviceStatus != "connected" || currentDevice == null) {
      return AUTO_SYNC_MODE_OFF
    }

    if (
      lastDiagnosticCode == "app_not_installed" ||
      lastDiagnosticCode == "device_not_connected" ||
      lastDiagnosticCode == "service_unavailable" ||
      lastDiagnosticCode == "invalid_state"
    ) {
      return AUTO_SYNC_MODE_OFF
    }

    return if (activityActive) AUTO_SYNC_MODE_ACTIVITY else AUTO_SYNC_MODE_IDLE
  }

  private fun resolveAutoSyncIntervalMs(mode: String): Long =
    when (mode) {
      AUTO_SYNC_MODE_ACTIVITY -> ACTIVITY_AUTO_SYNC_INTERVAL_MS
      AUTO_SYNC_MODE_IDLE -> IDLE_AUTO_SYNC_INTERVAL_MS
      else -> 0L
    }

  private fun stopAutoSyncInternal(clearMode: Boolean = true) {
    autoSyncRunnable?.let { autoSyncHandler.removeCallbacks(it) }
    autoSyncRunnable = null
    autoSyncNextAt = null
    if (clearMode) {
      autoSyncMode = AUTO_SYNC_MODE_OFF
      autoSyncIntervalMs = 0
    }
  }

  private fun updateAutoSyncSchedule(forceImmediate: Boolean = false) {
    val nextMode = resolveAutoSyncMode()
    if (nextMode == AUTO_SYNC_MODE_OFF) {
      stopAutoSyncInternal()
      return
    }

    val interval = resolveAutoSyncIntervalMs(nextMode)
    val delayMs = if (forceImmediate) 5_000L else interval
    val reason = if (nextMode == AUTO_SYNC_MODE_ACTIVITY) "auto-activity" else "auto-idle"

    stopAutoSyncInternal(clearMode = false)
    autoSyncMode = nextMode
    autoSyncIntervalMs = interval
    autoSyncNextAt = java.time.Instant.now().plusMillis(delayMs).toString()
    autoSyncRunnable =
      Runnable {
        autoSyncRunnable = null
        autoSyncNextAt = null

        if (resolveAutoSyncMode() == AUTO_SYNC_MODE_OFF) {
          stopAutoSyncInternal()
          emitStatusChanged()
          return@Runnable
        }

        sendPayload(buildSyncRequestPayload(reason))
        updateAutoSyncSchedule()
        emitStatusChanged()
      }

    autoSyncHandler.postDelayed(autoSyncRunnable!!, delayMs)
  }

  private fun extractActivityActive(payload: Map<String, Any?>): Boolean {
    val items = payload["items"] as? List<*> ?: return activityActive
    return containsActiveTimerState(items)
  }

  private fun containsActiveTimerState(items: List<*>): Boolean {
    items.forEach { item ->
      val payload = (item as? Map<*, *>)?.toStringKeyedMap() ?: return@forEach
      when (payload["messageType"] as? String) {
        "metric_sample" -> {
          if ((payload["metricKey"] as? String) == ACTIVITY_TIMER_STATE_KEY) {
            return isTimerStateActive(payload["metricValue"])
          }
        }
        "snapshot" -> {
          val nestedItems = payload["items"] as? List<*> ?: emptyList<Any?>()
          if (containsActiveTimerState(nestedItems)) {
            return true
          }
        }
      }
    }

    return false
  }

  private fun isTimerStateActive(value: Any?): Boolean {
    val normalized = value?.toString()?.trim()?.lowercase() ?: return false
    return normalized.isNotEmpty() &&
      normalized != "idle" &&
      normalized != "off" &&
      normalized != "none" &&
      normalized != "unknown" &&
      !normalized.startsWith("stop")
  }

  private fun inferActivityStateFromBatchJson(payloadJson: String?): Boolean {
    if (payloadJson.isNullOrBlank()) {
      return false
    }

    return try {
      val payload = parsePayloadJson(payloadJson)
      if (payload is Map<*, *>) {
        extractActivityActive(payload.toStringKeyedMap())
      } else {
        false
      }
    } catch (_: Exception) {
      false
    }
  }

  private fun handleIncomingDeviceHello(payload: Map<String, Any?>) {
    currentWatchDeviceId = payload["deviceId"] as? String
    currentWatchDeviceKind = payload["deviceKind"] as? String
    currentWatchDeviceModel = payload["deviceModel"] as? String
    currentWatchFirmwareVersion = payload["firmwareVersion"] as? String
    currentWatchAppVersion = payload["appVersion"] as? String
    currentWatchTimezoneOffsetMinutes = (payload["timezoneOffsetMinutes"] as? Number)?.toInt()
  }

  private fun handleIncomingCapabilities(payload: Map<String, Any?>) {
    currentCapabilitiesSupportedMetrics =
      (payload["supportedMetrics"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
    currentCapabilitiesSupportsBufferedSync =
      payload["supportsBufferedSync"] as? Boolean ?: currentCapabilitiesSupportsBufferedSync
    currentCapabilitiesSupportsLiveMode =
      payload["supportsLiveMode"] as? Boolean ?: currentCapabilitiesSupportsLiveMode
    currentCapabilitiesMaxBatchItems =
      (payload["maxBatchItems"] as? Number)?.toInt() ?: currentCapabilitiesMaxBatchItems
    currentCapabilitiesMaxBufferedSamples =
      (payload["maxBufferedSamples"] as? Number)?.toInt() ?: currentCapabilitiesMaxBufferedSamples
  }

  private fun handleIncomingLinkStatus(payload: Map<String, Any?>) {
    currentWatchLinkRecordedAt =
      payload["recordedAt"] as? String ?: currentWatchLinkRecordedAt
    currentWatchLinkHealth =
      payload["health"] as? String ?: currentWatchLinkHealth
    if (payload.containsKey("pendingBatchCount")) {
      pendingBatchCount = (payload["pendingBatchCount"] as? Number)?.toInt() ?: 0
    }
    if (payload.containsKey("lastBatchId")) {
      lastBatchId = payload["lastBatchId"] as? String
    }
    if (payload.containsKey("lastErrorCode")) {
      currentWatchLinkLastErrorCode = payload["lastErrorCode"] as? String
    }
  }

  private fun deviceMatchesPreference(device: IQDevice): Boolean {
    val friendlyName = device.friendlyName ?: return false

    return friendlyName.contains(preferredDeviceName, ignoreCase = true) ||
      friendlyName.contains(preferredDeviceKind, ignoreCase = true)
  }

  private fun resetAppScopedState() {
    currentWatchDeviceId = null
    currentWatchDeviceKind = null
    currentWatchDeviceModel = null
    currentWatchFirmwareVersion = null
    currentWatchAppVersion = null
    currentWatchTimezoneOffsetMinutes = null
    currentWatchLinkRecordedAt = null
    currentWatchLinkHealth = null
    currentWatchLinkLastErrorCode = null
    lastBatchId = null
    lastBatchJson = null
    pendingBatchCount = 0
    lastAckBatchId = null
    lastAckSampleId = null
    lastAckRecordedAt = null
    lastDiagnosticCode = null
    lastDiagnosticMessage = null
    lastDiagnosticBatchId = null
    lastDiagnosticRecordedAt = null
    currentCapabilitiesSupportedMetrics = emptyList()
    currentCapabilitiesSupportsBufferedSync = false
    currentCapabilitiesSupportsLiveMode = false
    currentCapabilitiesMaxBatchItems = 0
    currentCapabilitiesMaxBufferedSamples = 0
    autoSyncMode = AUTO_SYNC_MODE_OFF
    autoSyncIntervalMs = 0
    autoSyncNextAt = null
    activityActive = false
  }

  private fun restorePersistedState() {
    val cachedState = preferences.getString(buildStatusCacheKey(), null) ?: return

    try {
      val payload = JSONObject(cachedState)
      targetAppId = payload.optNullableString("targetAppId") ?: targetAppId
      preferredDeviceName = payload.optNullableString("preferredDeviceName") ?: preferredDeviceName
      preferredDeviceKind = payload.optNullableString("preferredDeviceKind") ?: preferredDeviceKind
      currentWatchDeviceId = payload.optNullableString("currentWatchDeviceId")
      currentWatchDeviceKind = payload.optNullableString("currentWatchDeviceKind")
      currentWatchDeviceModel = payload.optNullableString("currentWatchDeviceModel")
      currentWatchFirmwareVersion = payload.optNullableString("currentWatchFirmwareVersion")
      currentWatchAppVersion = payload.optNullableString("currentWatchAppVersion")
      currentWatchTimezoneOffsetMinutes =
        if (payload.has("currentWatchTimezoneOffsetMinutes") &&
          !payload.isNull("currentWatchTimezoneOffsetMinutes")) {
          payload.optInt("currentWatchTimezoneOffsetMinutes")
        } else {
          null
        }
      currentWatchLinkRecordedAt = payload.optNullableString("currentWatchLinkRecordedAt")
      currentWatchLinkHealth = payload.optNullableString("currentWatchLinkHealth")
      currentWatchLinkLastErrorCode = payload.optNullableString("currentWatchLinkLastErrorCode")
      lastBatchId = payload.optNullableString("lastBatchId")
      lastBatchJson = payload.optNullableString("lastBatchJson")
      activityActive =
        if (payload.has("activityActive") && !payload.isNull("activityActive")) {
          payload.optBoolean("activityActive")
        } else {
          inferActivityStateFromBatchJson(lastBatchJson)
        }
      pendingBatchCount = payload.optInt("pendingBatchCount", pendingBatchCount)
      lastAckBatchId = payload.optNullableString("lastAckBatchId")
      lastAckSampleId = payload.optNullableString("lastAckSampleId")
      lastAckRecordedAt = payload.optNullableString("lastAckRecordedAt")
      lastDiagnosticCode = payload.optNullableString("lastDiagnosticCode")
      lastDiagnosticMessage = payload.optNullableString("lastDiagnosticMessage")
      lastDiagnosticBatchId = payload.optNullableString("lastDiagnosticBatchId")
      lastDiagnosticRecordedAt = payload.optNullableString("lastDiagnosticRecordedAt")
      currentCapabilitiesSupportedMetrics =
        payload.optJSONArray("currentCapabilitiesSupportedMetrics")?.toStringList() ?: emptyList()
      currentCapabilitiesSupportsBufferedSync =
        payload.optBoolean(
          "currentCapabilitiesSupportsBufferedSync",
          currentCapabilitiesSupportsBufferedSync
        )
      currentCapabilitiesSupportsLiveMode =
        payload.optBoolean("currentCapabilitiesSupportsLiveMode", currentCapabilitiesSupportsLiveMode)
      currentCapabilitiesMaxBatchItems =
        payload.optInt("currentCapabilitiesMaxBatchItems", currentCapabilitiesMaxBatchItems)
      currentCapabilitiesMaxBufferedSamples =
        payload.optInt("currentCapabilitiesMaxBufferedSamples", currentCapabilitiesMaxBufferedSamples)
    } catch (error: Exception) {
      Log.w(LOG_TAG, "restorePersistedState failed", error)
      preferences.edit().remove(buildStatusCacheKey()).apply()
    }
  }

  private fun persistState() {
    val cachePayload = JSONObject().apply {
      put("targetAppId", targetAppId)
      put("preferredDeviceName", preferredDeviceName)
      put("preferredDeviceKind", preferredDeviceKind)
      put("currentWatchDeviceId", currentWatchDeviceId)
      put("currentWatchDeviceKind", currentWatchDeviceKind)
      put("currentWatchDeviceModel", currentWatchDeviceModel)
      put("currentWatchFirmwareVersion", currentWatchFirmwareVersion)
      put("currentWatchAppVersion", currentWatchAppVersion)
      put("currentWatchTimezoneOffsetMinutes", currentWatchTimezoneOffsetMinutes)
      put("currentWatchLinkRecordedAt", currentWatchLinkRecordedAt)
      put("currentWatchLinkHealth", currentWatchLinkHealth)
      put("currentWatchLinkLastErrorCode", currentWatchLinkLastErrorCode)
      put("lastBatchId", lastBatchId)
      put("lastBatchJson", lastBatchJson)
      put("activityActive", activityActive)
      put("pendingBatchCount", pendingBatchCount)
      put("lastAckBatchId", lastAckBatchId)
      put("lastAckSampleId", lastAckSampleId)
      put("lastAckRecordedAt", lastAckRecordedAt)
      put("lastDiagnosticCode", lastDiagnosticCode)
      put("lastDiagnosticMessage", lastDiagnosticMessage)
      put("lastDiagnosticBatchId", lastDiagnosticBatchId)
      put("lastDiagnosticRecordedAt", lastDiagnosticRecordedAt)
      put(
        "currentCapabilitiesSupportedMetrics",
        JSONArray(currentCapabilitiesSupportedMetrics)
      )
      put("currentCapabilitiesSupportsBufferedSync", currentCapabilitiesSupportsBufferedSync)
      put("currentCapabilitiesSupportsLiveMode", currentCapabilitiesSupportsLiveMode)
      put("currentCapabilitiesMaxBatchItems", currentCapabilitiesMaxBatchItems)
      put("currentCapabilitiesMaxBufferedSamples", currentCapabilitiesMaxBufferedSamples)
    }

    preferences.edit().putString(buildStatusCacheKey(), cachePayload.toString()).apply()
  }

  private fun buildStatusCacheKey(): String = "$PREF_STATUS_CACHE_PREFIX.$targetAppId"

  private fun recordOutgoingPayload(payload: Any) {
    val outgoingPayload =
      when (payload) {
        is Map<*, *> -> payload.toStringKeyedMap()
        else -> return
      }

    val messageType = outgoingPayload["messageType"] as? String
    if (messageType == "sync_request") {
      updateAutoSyncSchedule()
      emitStatusChanged()
      return
    }

    if (messageType != "batch_ack") {
      return
    }

    lastAckBatchId = outgoingPayload["batchId"] as? String
    lastAckSampleId = outgoingPayload["lastSampleId"] as? String
    lastAckRecordedAt = outgoingPayload["acknowledgedAt"] as? String
    lastBatchId = lastAckBatchId ?: lastBatchId
    pendingBatchCount = (pendingBatchCount - 1).coerceAtLeast(0)
    currentWatchLinkLastErrorCode = null
    persistState()
    updateAutoSyncSchedule()
    emitStatusChanged()
  }

  private fun parsePayloadJson(payloadJson: String): Any {
    val trimmedPayload = payloadJson.trim()
    if (trimmedPayload.startsWith("{")) {
      return jsonObjectToMap(JSONObject(trimmedPayload))
    }
    if (trimmedPayload.startsWith("[")) {
      return jsonArrayToList(JSONArray(trimmedPayload))
    }

    throw IllegalArgumentException("Unsupported payload")
  }

  private fun extractIncomingPayload(message: List<Any>?): Map<String, Any?>? {
    if (message.isNullOrEmpty()) {
      return null
    }

    val rootValue = if (message.size == 1) message[0] else message
    val normalizedValue = normalizeIncomingValue(rootValue)

    return when (normalizedValue) {
      is Map<*, *> -> normalizedValue.toStringKeyedMap()
      is String -> {
        try {
          val parsedValue = parsePayloadJson(normalizedValue)
          if (parsedValue is Map<*, *>) {
            parsedValue.toStringKeyedMap()
          } else {
            null
          }
        } catch (_: Exception) {
          null
        }
      }
      else -> null
    }
  }

  private fun normalizeIncomingValue(value: Any?): Any? = when (value) {
    null -> null
    is Map<*, *> -> value.toStringKeyedMap().mapValues { normalizeIncomingValue(it.value) }
    is List<*> -> value.map { normalizeIncomingValue(it) }
    else -> value
  }

  private fun jsonObjectToMap(jsonObject: JSONObject): HashMap<String, Any?> {
    val payload = hashMapOf<String, Any?>()
    val keys = jsonObject.keys()

    while (keys.hasNext()) {
      val key = keys.next()
      payload[key] = jsonValueToNativeValue(jsonObject.opt(key))
    }

    return payload
  }

  private fun jsonArrayToList(jsonArray: JSONArray): ArrayList<Any?> {
    val payload = arrayListOf<Any?>()

    for (index in 0 until jsonArray.length()) {
      payload.add(jsonValueToNativeValue(jsonArray.opt(index)))
    }

    return payload
  }

  private fun jsonValueToNativeValue(value: Any?): Any? = when (value) {
    null, JSONObject.NULL -> null
    is JSONObject -> jsonObjectToMap(value)
    is JSONArray -> jsonArrayToList(value)
    else -> value
  }

  private fun payloadToJsonString(payload: Map<String, Any?>): String {
    val jsonObject = JSONObject()
    payload.forEach { (key, value) ->
      jsonObject.put(key, nativeValueToJsonValue(value))
    }
    return jsonObject.toString()
  }

  private fun payloadToDebugString(payload: Any?): String = when (payload) {
    is Map<*, *> -> payloadToJsonString(payload.toStringKeyedMap())
    is List<*> -> JSONArray(payload.map { nativeValueToJsonValue(it) }).toString()
    null -> "null"
    else -> payload.toString()
  }

  private fun nativeValueToJsonValue(value: Any?): Any = when (value) {
    null -> JSONObject.NULL
    is Map<*, *> -> JSONObject().apply {
      value.forEach { (key, nestedValue) ->
        put(key.toString(), nativeValueToJsonValue(nestedValue))
      }
    }
    is List<*> -> JSONArray().apply {
      value.forEach { nestedValue ->
        put(nativeValueToJsonValue(nestedValue))
      }
    }
    else -> value
  }

  private fun Map<*, *>.toStringKeyedMap(): HashMap<String, Any?> {
    val payload = hashMapOf<String, Any?>()
    this.forEach { (key, value) ->
      if (key != null) {
        payload[key.toString()] = value
      }
    }
    return payload
  }

  private fun JSONObject.optNullableString(key: String): String? =
    if (has(key) && !isNull(key)) {
      optString(key)
    } else {
      null
    }

  private fun JSONArray.toStringList(): List<String> {
    val values = mutableListOf<String>()
    for (index in 0 until length()) {
      val value = opt(index)
      if (value is String) {
        values.add(value)
      }
    }
    return values
  }

  private fun resolveHealth(): String = when {
    lastDiagnosticCode == "service_unavailable" || lastDiagnosticCode == "invalid_state" -> "error"
    !isSdkReady && initializationStarted -> "connecting"
    !isSdkReady -> "disconnected"
    currentDevice == null && currentWatchDeviceId != null -> "degraded"
    currentDevice == null -> "degraded"
    currentDeviceStatus == "connected" -> "connected"
    else -> "degraded"
  }

  private fun clearDeviceNotConnectedDiagnostic() {
    if (lastDiagnosticCode != "device_not_connected") {
      return
    }

    clearLastDiagnostic()
  }

  private fun emitDeviceNotConnectedDiagnostic() {
    emitDiagnostic(
      "device_not_connected",
      "L appareil Garmin est connu mais n est pas connecte a Garmin Connect Mobile.",
      null
    )
  }

  private fun clearLastDiagnostic() {
    lastDiagnosticCode = null
    lastDiagnosticMessage = null
    lastDiagnosticBatchId = null
    lastDiagnosticRecordedAt = null
    persistState()
  }

  private fun createStatusMap(): com.facebook.react.bridge.WritableMap = Arguments.createMap().apply {
    putString("health", resolveHealth())
    putMap("linkStatus", createLinkStatusMap())
    val deviceHello = createDeviceHelloMap()
    if (deviceHello == null) {
      putNull("deviceHello")
    } else {
      putMap("deviceHello", deviceHello)
    }
    val capabilities = createCapabilitiesMap()
    if (capabilities == null) {
      putNull("capabilities")
    } else {
      putMap("capabilities", capabilities)
    }
    putString("lastBatchId", lastBatchId)
    putInt("pendingBatchCount", pendingBatchCount)
    putString("lastBatchJson", lastBatchJson)
    putString("autoSyncMode", autoSyncMode)
    if (autoSyncIntervalMs > 0) {
      putDouble("autoSyncIntervalMs", autoSyncIntervalMs.toDouble())
    } else {
      putNull("autoSyncIntervalMs")
    }
    putString("autoSyncNextAt", autoSyncNextAt)
    putBoolean("activityActive", activityActive)
    val lastDiagnostic = createLastDiagnosticMap()
    if (lastDiagnostic == null) {
      putNull("lastDiagnostic")
    } else {
      putMap("lastDiagnostic", lastDiagnostic)
    }
  }

  private fun createLinkStatusMap(): com.facebook.react.bridge.WritableMap = Arguments.createMap().apply {
    putString("messageType", "link_status")
    putString("recordedAt", currentWatchLinkRecordedAt ?: java.time.Instant.now().toString())
    putString("health", currentWatchLinkHealth ?: resolveHealth())
    putInt("pendingBatchCount", pendingBatchCount)
    putString("lastBatchId", lastBatchId)
    putString("lastErrorCode", currentWatchLinkLastErrorCode)
  }

  private fun createDeviceHelloMap(): com.facebook.react.bridge.WritableMap? {
    val device = currentDevice
    val deviceId = currentWatchDeviceId ?: device?.friendlyName
    val deviceKind =
      currentWatchDeviceKind
        ?: device?.friendlyName?.let { friendlyName ->
          if (friendlyName.contains("edge", ignoreCase = true)) "edge" else "fenix"
        }
    val deviceModel = currentWatchDeviceModel ?: device?.friendlyName

    if (deviceId == null || deviceKind == null || deviceModel == null) {
      return null
    }

    return Arguments.createMap().apply {
      putString("messageType", "device_hello")
      putString("deviceId", deviceId)
      putString("deviceKind", deviceKind)
      putString("deviceModel", deviceModel)
      putString("firmwareVersion", currentWatchFirmwareVersion ?: "pending-watch-handshake")
      putString("appVersion", currentWatchAppVersion ?: "watch-pending")
      putInt(
        "timezoneOffsetMinutes",
        currentWatchTimezoneOffsetMinutes
          ?: java.util.TimeZone.getDefault().getOffset(System.currentTimeMillis()) / 60000
      )
    }
  }

  private fun emitStatusChanged() {
    Log.d(
      LOG_TAG,
      "emitStatusChanged health=${resolveHealth()} device=${currentDevice?.friendlyName ?: "none"} deviceStatus=$currentDeviceStatus pendingBatchCount=$pendingBatchCount lastDiagnostic=$lastDiagnosticCode"
    )
    emitEvent(EVENT_STATUS_CHANGED, createStatusMap())
  }

  private fun emitDiagnostic(
    code: String,
    message: String,
    batchId: String?,
    recordedAt: String? = null
  ) {
    if (
      code == "app_not_installed" ||
      code == "device_not_connected" ||
      code == "service_unavailable" ||
      code == "invalid_state"
    ) {
      stopAutoSyncInternal()
    }
    lastDiagnosticCode = code
    lastDiagnosticMessage = message
    lastDiagnosticBatchId = batchId
    lastDiagnosticRecordedAt = recordedAt ?: java.time.Instant.now().toString()
    Log.w(LOG_TAG, "emitDiagnostic code=$code batchId=$batchId message=$message")
    persistState()
    createLastDiagnosticMap()?.let { emitEvent(EVENT_DIAGNOSTIC, it) }
    emitStatusChanged()
  }

  private fun createCapabilitiesMap(): com.facebook.react.bridge.WritableMap? =
    if (
      currentCapabilitiesSupportedMetrics.isEmpty() &&
      !currentCapabilitiesSupportsBufferedSync &&
      !currentCapabilitiesSupportsLiveMode &&
      currentCapabilitiesMaxBatchItems == 0 &&
      currentCapabilitiesMaxBufferedSamples == 0
    ) {
      null
    } else {
      Arguments.createMap().apply {
        val supportedMetrics = Arguments.createArray()
        currentCapabilitiesSupportedMetrics.forEach { metric ->
          supportedMetrics.pushString(metric)
        }
        putString("messageType", "device_capabilities")
        putArray("supportedMetrics", supportedMetrics)
        putBoolean("supportsBufferedSync", currentCapabilitiesSupportsBufferedSync)
        putBoolean("supportsLiveMode", currentCapabilitiesSupportsLiveMode)
        putInt("maxBatchItems", currentCapabilitiesMaxBatchItems)
        putInt("maxBufferedSamples", currentCapabilitiesMaxBufferedSamples)
      }
    }

  private fun createLastDiagnosticMap(): com.facebook.react.bridge.WritableMap? =
    if (lastDiagnosticCode == null || lastDiagnosticMessage == null) {
      null
    } else {
      Arguments.createMap().apply {
        putString("messageType", "sync_diagnostic")
        putString("code", lastDiagnosticCode)
        putString("message", lastDiagnosticMessage)
        putString("recordedAt", lastDiagnosticRecordedAt ?: java.time.Instant.now().toString())
        putString("batchId", lastDiagnosticBatchId)
      }
    }

  private fun emitEvent(eventName: String, payload: com.facebook.react.bridge.WritableMap) {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, payload)
  }
}
