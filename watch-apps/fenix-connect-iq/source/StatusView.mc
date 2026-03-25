using Toybox.Graphics;
using Toybox.WatchUi;

class StatusView extends WatchUi.View {
    var mCollector;
    var mLinkService;
    var mLines;

    function initialize(collector, linkService) {
        View.initialize();
        mCollector = collector;
        mLinkService = linkService;
        mLines = [];
    }

    function onShow() {
        refresh();
    }

    function refresh() {
        mLines = [
            Rez.Strings.StatusTitle,
            "Protocol v" + GarminContract.PROTOCOL_VERSION,
            mLinkService.getStatusLine(),
            "Last sync " + mLinkService.getLastSyncAt()
        ];

        var collectorLines = mCollector.getDisplayLines();
        for (var lineIndex = 0; lineIndex < collectorLines.size(); lineIndex += 1) {
            mLines.add(collectorLines[lineIndex]);
        }

        mLines.add(Rez.Strings.HintSelect);
        mLines.add(Rez.Strings.HintMenu);
        WatchUi.requestUpdate();
    }

    function onUpdate(dc) {
        var y = 16;
        dc.clear();
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);

        for (var lineIndex = 0; lineIndex < mLines.size(); lineIndex += 1) {
            dc.drawText(12, y, Graphics.FONT_XTINY, mLines[lineIndex], Graphics.TEXT_JUSTIFY_LEFT);
            y += 22;
        }
    }
}
