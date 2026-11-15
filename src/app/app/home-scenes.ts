// The illustrations of the home page (approved by the partner, 2026-11-15):
// one character per kind of business, in the order of textos.inicio.negocios,
// and the booking story last. Static SVG markup, written here and never built
// from anything a person types. The classes are styled in ./home.css.

export const CHARACTERS: readonly string[] = [
  `<ellipse class="yp-shadow" cx="60" cy="112" rx="34" ry="5"/>
   <path class="yp-dk" d="M30 112c0-16 13-24 30-24s30 8 30 24z"/><path class="yp-w" d="M52 88h16l-8 12z"/>
   <path class="yp-ink yp-hair" d="M31 66C26 38 40 26 44 30l4-10 6 9 6-11 6 11 6-9 4 10c4-4 18 8 13 36z"/>
   <circle class="yp-w" cx="60" cy="66" r="27"/><circle class="yp-pk" cx="42" cy="74" r="5" opacity=".7"/><circle class="yp-pk" cx="78" cy="74" r="5" opacity=".7"/>
   <circle class="yp-ink yp-pop" cx="51" cy="64" r="3.500"/><circle class="yp-ink yp-pop" cx="69" cy="64" r="3.500"/><path class="yp-st" d="M50 76q10 9 20 0"/>
   <g transform="translate(128 0) scale(-.46 .46)" stroke="#ffc857" stroke-width="7" fill="none" stroke-linecap="round"><g class="yp-bl1"><circle cx="34" cy="82" r="11"/><path d="M43 75 100 36"/></g><g class="yp-bl2"><circle cx="34" cy="38" r="11"/><path d="M43 45 100 84"/></g></g>
   <path class="yp-st yp-bit" d="M78 30l5 3"/><path class="yp-st yp-bit" style="--d:.27s" d="M72 34l4-3"/><path class="yp-st yp-bit" style="--d:.54s" d="M84 36l5 2"/>`,
  `<ellipse class="yp-shadow" cx="60" cy="112" rx="34" ry="5"/>
   <circle class="yp-w" cx="60" cy="66" r="34"/><circle class="yp-pk" cx="36" cy="72" r="6" opacity=".7"/><circle class="yp-pk" cx="84" cy="72" r="6" opacity=".7"/>
   <path class="yp-st" d="M42 56q6-7 12 0M66 56q6-7 12 0"/>
   <path class="yp-ink" d="M40 68h40q-2 22-20 22T40 68z"/><path class="yp-pk" d="M50 84q10-7 20 0-4 6-10 6t-10-6z"/>
   <rect class="yp-w" x="45" y="68" width="7" height="9" rx="1.500"/><rect class="yp-w" x="60.500" y="68" width="7" height="9" rx="1.500"/><rect class="yp-w" x="68.300" y="68" width="7" height="9" rx="1.500"/>
   <rect class="yp-am yp-tooth" x="52.700" y="68" width="7" height="9" rx="1.500"/>
   <path class="yp-am yp-twk" style="--d:.2s" d="M104 22l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><path class="yp-w yp-twk" style="--d:.7s" d="M16 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>`,
  `<ellipse class="yp-shadow" cx="60" cy="112" rx="34" ry="5"/>
   <path class="yp-earL" fill="#7a4a00" d="M40 48c-16-6-26 8-20 30 10 3 18-4 20-16z"/><path class="yp-earR" fill="#7a4a00" d="M80 48c16-6 26 8 20 30-10 3-18-4-20-16z"/>
   <circle class="yp-am" cx="60" cy="64" r="29"/><ellipse class="yp-w" cx="60" cy="76" rx="17" ry="13"/>
   <circle class="yp-ink yp-pop" cx="49" cy="58" r="4"/><circle class="yp-ink yp-pop" cx="71" cy="58" r="4"/><circle class="yp-w" cx="50.500" cy="56.500" r="1.300"/><circle class="yp-w" cx="72.500" cy="56.500" r="1.300"/>
   <ellipse class="yp-ink" cx="60" cy="70" rx="6" ry="4"/><path class="yp-st" d="M60 74v4M51 78q4.500 6 9 0q4.500 6 9 0"/>
   <path class="yp-pk yp-tongue" d="M55 82v7a5 5 0 0 0 10 0v-7z"/>
   <path class="yp-pk yp-beat" d="M102 30c-8-7-12-10-12-15a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 5-4 8-12 15z"/>`,
  `<ellipse class="yp-shadow" cx="46" cy="112" rx="30" ry="5"/>
   <path class="yp-dk" d="M20 112c0-14 11-20 26-20s26 6 26 20z"/>
   <path class="yp-ink" d="M22 68c0-18 10-28 24-28s24 10 24 28c-6-10-14-14-24-14s-18 4-24 14z"/>
   <circle class="yp-w" cx="46" cy="72" r="24"/><circle class="yp-ink yp-pop" cx="38" cy="70" r="3"/><circle class="yp-ink yp-pop" cx="54" cy="70" r="3"/><path class="yp-st" d="M38 80q8 7 16 0"/>
   <circle class="yp-w yp-pop" style="--d:.5s" cx="72" cy="46" r="3"/><circle class="yp-w yp-pop" style="--d:.7s" cx="79" cy="38" r="4.500"/>
   <ellipse class="yp-w yp-pop" style="--d:.9s" cx="96" cy="22" rx="22" ry="18"/>
   <path class="yp-st yp-scrib" d="M82 22c4-9 6 9 10 0s6 9 10 0 6 9 8 2"/>
   <path class="yp-pk yp-pop yp-heart2" style="--d:1.900s" d="M96 33c-9-7-12-11-12-15a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 4-3 8-12 15z"/>`,
  `<ellipse class="yp-shadow" cx="60" cy="112" rx="34" ry="5"/>
   <path class="yp-sw yp-steam" d="M44 22c-5-6 5-9 0-16"/><path class="yp-sw yp-steam" style="--d:.5s" d="M60 18c-5-6 5-9 0-16"/><path class="yp-sw yp-steam" style="--d:1s" d="M76 22c-5-6 5-9 0-16"/>
   <circle class="yp-w" cx="60" cy="70" r="30"/>
   <path class="yp-mt" d="M30 62c2-18 14-28 30-28s28 10 30 28c-10-7-20-10-30-10s-20 3-30 10z"/><path fill="#8fdfe6" d="M30 62c10-7 20-10 30-10s20 3 30 10l-1 4c-9-6-19-8-29-8s-20 2-29 8z"/>
   <circle class="yp-gr yp-pop" cx="48" cy="72" r="9"/><circle class="yp-gr yp-pop" cx="72" cy="72" r="9"/><circle class="yp-pop" fill="#d8f5d0" style="--d:.5s" cx="48" cy="72" r="4"/><circle class="yp-pop" fill="#d8f5d0" style="--d:.5s" cx="72" cy="72" r="4"/>
   <path class="yp-st" d="M52 88q8 6 16 0"/>`,
  `<ellipse class="yp-shadow" cx="60" cy="112" rx="40" ry="5"/>
   <path class="yp-w" d="M18 108V64a12 12 0 0 1 24 0v44zM48 108V56a12 12 0 0 1 24 0v52zM78 108V64a12 12 0 0 1 24 0v44z"/>
   <path class="yp-pk yp-paint" d="M21 80V64a9 9 0 0 1 18 0v16z"/><path class="yp-pk yp-paint" style="--d:1.200s" d="M51 74V56a9 9 0 0 1 18 0v18z"/><path class="yp-pk yp-paint" style="--d:2.100s" d="M81 80V64a9 9 0 0 1 18 0v16z"/>
   <g class="yp-brush"><rect class="yp-ink" x="27" y="6" width="6" height="26" rx="3"/><rect class="yp-am" x="25.500" y="30" width="9" height="12" rx="2"/></g>
   <path class="yp-am yp-twk" style="--d:.4s" d="M108 28l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>`,
];

// Someone books on the phone, the way draws and they arrive (viewBox 0 0 300 132).
export const BOOKING_STORY = `
  <rect x="20" y="28" width="54" height="96" rx="9" fill="rgba(255,255,255,.14)"/><path d="M40 36h14"/>
  <rect x="29" y="50" width="36" height="8" rx="4" fill="#fff" stroke="none" opacity=".5"/><rect x="29" y="64" width="26" height="8" rx="4" fill="#fff" stroke="none" opacity=".5"/>
  <rect x="29" y="88" width="36" height="16" rx="8" fill="#ffc857" stroke="none"/><circle class="yp-tap" cx="47" cy="96" r="7" fill="#fff" stroke="none"/>
  <path class="yp-okk" pathLength="1" stroke="#16211f" d="M40 96l5 5 9-10"/>
  <path class="yp-way" pathLength="1" stroke="#ffc857" stroke-width="3.500" d="M74 78C120 20 170 130 236 92"/>
  <circle class="yp-walker" r="8" fill="#fff" stroke="none"/>
  <path d="M226 88h54l-5-14h-44z" fill="#ff8fa3" stroke="none"/><path d="M231 88v36h44V88" fill="rgba(255,255,255,.14)"/><rect class="yp-door" x="246" y="100" width="14" height="24" rx="2" fill="#fff" stroke="none"/>
  <g class="yp-pin"><path d="M253 40c-9 0-15 7-15 14 0 10 15 23 15 23s15-13 15-23c0-7-6-14-15-14z" fill="#ffc857" stroke="none"/><circle cx="253" cy="54" r="5" fill="#16211f" stroke="none"/></g>`;
