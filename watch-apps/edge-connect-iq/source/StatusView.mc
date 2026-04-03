using Toybox.Graphics;
using Toybox.WatchUi;

class StatusView extends WatchUi.View {
    var mCollector;
    var mLinkService;
    var mLines;
    var mScrollOffset;
    var mVisibleLineCount;

    function initialize(collector, linkService) {
        View.initialize();
        mCollector = collector;
        mLinkService = linkService;
        mLines = [];
        mScrollOffset = 0;
        mVisibleLineCount = 8;
    }

    function onShow() {
        refresh();
    }

    function refresh() {
        mLines = [];

        appendLines([
            "PROTO v" + GarminContract.PROTOCOL_VERSION
        ]);
        appendLines(mLinkService.getDisplayLines());
        appendLines(mCollector.getDisplayLines());
        clampScrollOffset();
        WatchUi.requestUpdate();
    }

    function onUpdate(dc) {
        dc.clear();
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        var screenWidth = dc.getWidth();
        var screenHeight = dc.getHeight();
        var contentInset = screenWidth >= 240 ? 26 : 18;
        var titleY = 18;
        var titleFont = Graphics.FONT_SMALL;
        var lineFont = Graphics.FONT_XTINY;
        var footerFont = Graphics.FONT_XTINY;
        var titleHeight = Graphics.getFontHeight(titleFont);
        var lineHeight = Graphics.getFontHeight(lineFont) + 6;
        var footerHeight = Graphics.getFontHeight(footerFont);
        var contentTop = titleY + titleHeight + 18;
        var footerTop = screenHeight - (footerHeight * 2) - 14;

        mVisibleLineCount = computeVisibleLineCount(contentTop, footerTop, lineHeight);
        clampScrollOffset();

        dc.drawText(screenWidth / 2, titleY, titleFont, Rez.Strings.AppName, Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(screenWidth / 2, titleY + titleHeight, lineFont, "Edge 1030", Graphics.TEXT_JUSTIFY_CENTER);

        var y = contentTop;
        var lastVisibleIndex = mScrollOffset + mVisibleLineCount;
        if (lastVisibleIndex > mLines.size()) {
            lastVisibleIndex = mLines.size();
        }

        for (var lineIndex = mScrollOffset; lineIndex < lastVisibleIndex; lineIndex += 1) {
            var line = mLines[lineIndex];
            if (isSectionLine(line)) {
                dc.drawText(screenWidth / 2, y, lineFont, line, Graphics.TEXT_JUSTIFY_CENTER);
            } else {
                dc.drawText(contentInset, y, lineFont, line, Graphics.TEXT_JUSTIFY_LEFT);
            }
            y += lineHeight;
        }

        dc.drawText(screenWidth / 2, footerTop, footerFont, buildScrollLabel(lastVisibleIndex), Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(contentInset, footerTop + footerHeight + 4, footerFont, "Select sync", Graphics.TEXT_JUSTIFY_LEFT);
        dc.drawText(screenWidth - contentInset, footerTop + footerHeight + 4, footerFont, "Menu link", Graphics.TEXT_JUSTIFY_RIGHT);
    }

    function scrollNext() {
        return setScrollOffset(mScrollOffset + 1);
    }

    function scrollPrevious() {
        return setScrollOffset(mScrollOffset - 1);
    }

    function appendLines(lines) {
        for (var lineIndex = 0; lineIndex < lines.size(); lineIndex += 1) {
            mLines.add(lines[lineIndex]);
        }
    }

    function isSectionLine(line) {
        return line == "LIEN" || line == "LIVE" || line == "JOUR";
    }

    function setScrollOffset(nextOffset) {
        var maxOffset = getMaxScrollOffset();
        if (nextOffset < 0) {
            nextOffset = 0;
        }
        if (nextOffset > maxOffset) {
            nextOffset = maxOffset;
        }
        if (nextOffset == mScrollOffset) {
            return false;
        }

        mScrollOffset = nextOffset;
        WatchUi.requestUpdate();
        return true;
    }

    function clampScrollOffset() {
        var maxOffset = getMaxScrollOffset();
        if (mScrollOffset > maxOffset) {
            mScrollOffset = maxOffset;
        }
        if (mScrollOffset < 0) {
            mScrollOffset = 0;
        }
    }

    function getMaxScrollOffset() {
        var maxOffset = mLines.size() - mVisibleLineCount;
        if (maxOffset < 0) {
            return 0;
        }

        return maxOffset;
    }

    function computeVisibleLineCount(contentTop, footerTop, lineHeight) {
        var count = 0;
        var cursor = contentTop;

        while ((cursor + lineHeight) <= footerTop) {
            count += 1;
            cursor += lineHeight;
        }

        if (count < 1) {
            return 1;
        }

        return count;
    }

    function buildScrollLabel(lastVisibleIndex) {
        if (mLines.size() <= mVisibleLineCount) {
            return "Tout visible";
        }

        return "Up/Down " + (mScrollOffset + 1).format("%.0f") + "-" + lastVisibleIndex.format("%.0f") + "/" + mLines.size().format("%.0f");
    }
}
