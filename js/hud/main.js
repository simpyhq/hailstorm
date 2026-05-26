/* main.js — entry point. Wires modules together once the DOM is parsed.
   Loaded last so window.JARVIS.{core,orb,sim,parallax,panels,boot,live} exist. */
(function (J) {
  'use strict';

  // listeners that don't depend on the reveal can attach immediately
  J.panels.init();

  // real data starts fetching right away so it's ready by the time we reveal
  J.live.start();

  // run the boot sequence; everything visual kicks off the instant it reveals
  J.boot.run(function startup() {
    J.orb.start();
    J.sim.startClock();
    J.sim.startSystem();
    J.sim.loadQuote();
    J.sim.startPeripherals();
    J.parallax.init();
    setTimeout(() => J.panels.showBrief(), 600);
  });
})(window.JARVIS = window.JARVIS || {});
