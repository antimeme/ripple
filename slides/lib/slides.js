// Script to integrate slides with visualizations
(function() {
    "use strict";
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = window.location.search.match(/document/gi) ?
                'lib/reveal/pdf.css' : 'lib/reveal/paper.css';
    document.getElementsByTagName('head')[0].appendChild( link );
    Reveal.initialize({
        slideNumber: 'h.v',
        transition: 'convex', history: true,
        showNotes: window.location.search.match(/shownotes/gi) ?
                   true : false,
        dependencies: [
	    /* { src: 'lib/js/classList.js',
             *   condition: function() { return !document.body.classList; } },
	       { src: 'plugin/markdown/marked.js',
             *   condition: function() {
             *       return !!document.querySelector( '[data-markdown]' );
             *   } },
	       { src: 'plugin/markdown/markdown.js',
             *   condition: function() {
             *       return !!document.querySelector( '[data-markdown]' );
             *   } },
	       { src: 'plugin/highlight/highlight.js',
             *   async: true, callback: function() {
             *       hljs.initHighlightingOnLoad(); } },
	       { src: 'plugin/zoom-js/zoom.js', async: true },*/
	    { src: 'lib/reveal/search.js', async: true },
	    { src: 'lib/reveal/notes.js', async: true }
        ]
    });

    Reveal.addEventListener('ready', function(event) {
        triggy.setup('canvas.triggy', function(value) {
            if (typeof(value) === 'object') {
                value.x /= Reveal.getScale();
                value.y /= Reveal.getScale();
            } else if (typeof(value) === 'number') {
                value /= Reveal.getScale();
            }
            return value;
        });
        triggy.update('canvas.triggy', Reveal.getCurrentSlide());
    });

    Reveal.addEventListener('slidechanged', function(event) {
        triggy.update('canvas.triggy', event.currentSlide);
    });

    logic.go();
})();
