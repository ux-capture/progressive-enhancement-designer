(function () {
    /**
     * Function that returns configuration based on the URL of the page
     * 
     * @param {*} url
     * @returns UX Capture configuration array
     */
    function getZones(url) {
        if (window.UXCapture && window.UXCapture.getViewConfig) {
            return window.UXCapture.getViewConfig();
        }
    }

    /**
     * Progressive Enhancement Designer implementation
     */

    const zones = getZones(window.location.href);

    if (!zones) {
        console.log("No definitions exist for this page");
        return;
    }

    const THE_REST_DISPLAYED_LATENCY = 5000;

    const ZONE_COLORS = ["#fbba00", "#77379a", "#ff594b", "#00bba0"];
    const REST_COLOR = "grey";
    const PROGRESS_INDICATOR_COLOR = "#1ab2ff";

    const INDICATOR_CLASS = "--progressive-enhancement-indicator";
    const OVERLAY_CLASS = "--progressive-enhancement-overlay";
    const OVERLAY_BOX_BORDER = 2;
    const WAIT_AFTER_INDICATOR_DONE = 5000;

    const UI_STYLE_ID = "--progressive-enhancement-designer-styles-ui";
    let uiStyleTag = document.getElementById(UI_STYLE_ID);

    if (!uiStyleTag) {
        const head = document.querySelector('body');
        uiStyleTag = document.createElement('style');
        uiStyleTag.setAttribute('id', UI_STYLE_ID)
        head.appendChild(uiStyleTag);
    }

    uiStyleTag.innerHTML = `.${INDICATOR_CLASS} {
        position: fixed;
        bottom: 0.5em;
        visibility: visible !important;
        text-align: right;
        color: white;
        font-weight: bold;
        padding: 0.2em;
        font-size: 1.5em;
        width: 0;
    }
    
    .${INDICATOR_CLASS}-progress {
        left: 0;
        bottom: 0;
        height: 0.5em;
        background-color: ${PROGRESS_INDICATOR_COLOR};
        transition: width ${THE_REST_DISPLAYED_LATENCY}ms linear;
    }

    .${INDICATOR_CLASS}-progress-start {
        width: 0;
    }
    .${INDICATOR_CLASS}-progress-end {
        width: 100%;
    }

    .${OVERLAY_CLASS} {
        position: absolute;
        opacity: 0.2;
        z-index: 10000;
    }

    `;

    const PLAYBACK_STYLE_ID = "--progressive-enhancement-designer-styles";
    let styleTag = document.getElementById(PLAYBACK_STYLE_ID);

    if (!styleTag) {
        const head = document.querySelector('body');
        styleTag = document.createElement('style');
        styleTag.setAttribute('id', PLAYBACK_STYLE_ID)
        head.appendChild(styleTag);
    }


    let highlightElements = [];
    let indicatorElements = [];
    let timers = [];

    function toggleHighlight() {
        if (highlightElements.length) {
            removeHighlight();
        } else {
            highlight();
        }
    }

    function highlight() {
        let colorIndex = 0;
        for (let zone of zones) {
            const zoneHTMLElements = zone.elements
                .reduce((zoneSelectors, element) => [element.selector, ...zoneSelectors], [])
                .map(selector => Array.from(document.querySelectorAll(selector)))
                .flat();

            const zoneColor = ZONE_COLORS[colorIndex++];
            for (const zoneElement of zoneHTMLElements) {
                const overlay = document.createElement('div');
                overlay.className = OVERLAY_CLASS;
                overlay.style.backgroundColor = zoneColor;

                const rect = zoneElement.getBoundingClientRect();
                overlay.style.left = `${rect.x + window.scrollX - OVERLAY_BOX_BORDER}px`;
                overlay.style.top = `${rect.y + window.scrollY - OVERLAY_BOX_BORDER}px`;
                overlay.style.width = `${rect.width + OVERLAY_BOX_BORDER * 2}px`;
                overlay.style.height = `${rect.height + OVERLAY_BOX_BORDER * 2}px`;

                document.body.append(overlay);

                highlightElements.push(overlay);
            }
        }
    }

    function removeHighlight() {
        for (const element of highlightElements) {
            document.body.removeChild(element);
        }

        highlightElements = [];
    }


    function hideIndicators() {
        for (let timer of timers) {
            clearTimeout(timer);
        }

        timers = [];

        for (let indicator of indicatorElements) {
            document.body.removeChild(indicator);
        }

        indicatorElements = [];
    }

    function replay() {
        hideIndicators();

        // hide all the content
        const initialStyles = `
                * {
                    visibility: hidden!important;
                }
                    `;

        let styles = initialStyles;
        let previousLatency = 0;

        for (let zone of zones) {
            styles += zone.elements.reduce((zoneSelectors, element) => [element.selector, ...zoneSelectors], []).join(', ') + ' { visibility: visible !important; }';
            zone.styles = styles;

            // set up latency bands
            zone.previousLatency = previousLatency;
            previousLatency = zone.estimatedLatency;
        }

        // trigger clean screen
        styleTag.innerHTML = "body { display: none; }"; // hide / collapse everything
        styleTag.offsetHeight; // trigger reflow

        // set initial styles (layouts everything but hides it)
        styleTag.innerHTML = initialStyles;

        function createPhaseIndicator(color, startLatency, endLatency) {
            const phaseIndicator = document.createElement("div");

            const startPosition = startLatency * 100 / THE_REST_DISPLAYED_LATENCY;
            const endPosition = endLatency * 100 / THE_REST_DISPLAYED_LATENCY;

            phaseIndicator.className = INDICATOR_CLASS;

            phaseIndicator.style.left = startPosition + "%";
            phaseIndicator.style.backgroundColor = color;
            phaseIndicator.innerText = endLatency + "ms";
            phaseIndicator.style.width = (endPosition - startPosition) + "%";

            document.body.appendChild(phaseIndicator);

            return phaseIndicator;
        }

        let colorIndex = 0;

        const progressIndicator = document.createElement("div");
        progressIndicator.className = `${INDICATOR_CLASS} ${INDICATOR_CLASS}-progress ${INDICATOR_CLASS}-progress-start`;
        document.body.appendChild(progressIndicator);
        progressIndicator.offsetHeight; // trigger reflow
        progressIndicator.className = `${INDICATOR_CLASS} ${INDICATOR_CLASS}-progress ${INDICATOR_CLASS}-progress-end`;

        indicatorElements.push(progressIndicator);

        for (let zone of zones) {
            timers.push(setTimeout(function () {
                styleTag.innerHTML = zone.styles;
                indicatorElements.push(createPhaseIndicator(ZONE_COLORS[colorIndex++], zone.previousLatency, zone.estimatedLatency));
            }, zone.estimatedLatency));
        }

        timers.push(setTimeout(function () {
            styleTag.innerHTML = "";

            indicatorElements.push(createPhaseIndicator(REST_COLOR, zones[zones.length - 1].estimatedLatency, THE_REST_DISPLAYED_LATENCY));

            timers.push(setTimeout(hideIndicators, WAIT_AFTER_INDICATOR_DONE));
        }, THE_REST_DISPLAYED_LATENCY));
    }

    document.addEventListener('keydown', (event) => {
        const keyName = event.key;

        if (keyName === 'Control') {
            // do not alert when only Control key is pressed.
            return;
        }

        if (event.ctrlKey) {
            if (keyName === "1") {
                console.log("Toggle highlighted zones");
                toggleHighlight();
            } else if (keyName === "2") {
                console.log("Replaying the experience");
                replay();
            }
        }
    }, false);

})();
