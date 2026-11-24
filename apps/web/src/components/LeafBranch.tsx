import { useId } from 'react';
import { PIGMENT_PATCHES } from './botanical-art';

const LEAVES = [
  {
    shape:
      'M-12 508C44 455 91 351 150 291C190 249 232 239 285 243C246 269 222 311 199 342C150 408 83 473-12 508Z',
    pigment:
      'M8 487C71 424 112 341 165 292C193 269 222 258 251 255C218 284 202 324 177 354C129 412 73 457 8 487Z',
    vein: 'M-17 510C52 470 105 389 152 313',
  },
  {
    shape:
      'M246 390C298 333 332 246 376 195C418 145 475 116 532 90C501 132 482 183 453 232C405 311 327 365 246 390Z',
    pigment:
      'M266 372C315 315 344 244 389 195C425 157 470 130 505 117C473 167 465 198 433 245C388 307 323 351 266 372Z',
    vein: 'M-17 510C137 461 288 389 382 264',
  },
  {
    shape:
      'M365 315C429 264 479 185 548 120C606 70 708 28 750 4C722 57 698 99 667 144C642 184 612 221 574 239C510 270 435 292 365 315Z',
    pigment:
      'M389 300C451 246 499 173 558 122C611 79 676 53 716 30C682 99 643 170 596 207C550 244 463 278 389 300Z',
    vein: 'M-17 510C209 440 436 303 637 113',
  },
  {
    shape:
      'M190 429C260 387 326 356 399 348C477 340 562 346 625 313C594 351 566 394 524 416C477 442 428 434 375 426C312 416 251 422 190 429Z',
    pigment:
      'M211 419C283 382 341 364 405 359C481 352 553 351 599 333C564 374 542 397 504 413C459 431 420 419 377 415C314 409 263 415 211 419Z',
    vein: 'M-17 510C143 451 295 398 465 384',
  },
  {
    shape:
      'M-12 510C101 498 251 504 393 484C404 482 408 485 400 497C365 539 301 565 222 562C145 563 67 532-12 510Z',
    pigment: 'M10 514C133 508 255 516 382 494C346 528 294 549 224 550C149 550 77 529 10 514Z',
    vein: 'M-17 510C98 505 195 533 298 513',
  },
];

export function LeafBranch({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const paint = `${id}-leaf-paint`;
  const edge = `${id}-leaf-edge`;
  const gold = `${id}-leaf-gold`;
  const patches = `${id}-leaf-patches`;
  return (
    <svg
      className={`leaf-branch ${className}`}
      viewBox="0 0 780 600"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter
          id={paint}
          x="-8%"
          y="-8%"
          width="116%"
          height="116%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".018 .065"
            numOctaves="3"
            seed="17"
            result="grain"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="grain"
            scale="7"
            xChannelSelector="R"
            yChannelSelector="G"
            result="pigment"
          />
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 .4 .35 .25 0 .16"
            result="paper"
          />
          <feComposite in="pigment" in2="paper" operator="in" />
        </filter>
        <filter id={edge} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".035 .085"
            numOctaves="2"
            seed="5"
            result="grain"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="grain"
            scale="2.8"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <linearGradient id={gold} x1="0" y1="500" x2="700" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d6b79c" />
          <stop offset=".48" stopColor="#e4c499" />
          <stop offset="1" stopColor="#d6b79c" />
        </linearGradient>
        <pattern
          id={patches}
          width="96"
          height="84"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-13) scale(1.2)"
        >
          {PIGMENT_PATCHES.map((patch) => (
            <path
              key={patch.shape}
              d={patch.shape}
              fill={
                patch.ink === 'paper' ? '#fdfaf3' : patch.ink === 'sage' ? '#cdded8' : '#9fbdb6'
              }
              opacity={patch.opacity * 2.4}
            />
          ))}
        </pattern>
        {LEAVES.map((leaf, index) => (
          <clipPath key={leaf.shape} id={`${id}-leaf-${index}`}>
            <path d={leaf.shape} />
          </clipPath>
        ))}
      </defs>
      {LEAVES.map((leaf, index) => (
        <g key={leaf.shape}>
          <g clipPath={`url(#${id}-leaf-${index})`}>
            <path d={leaf.shape} fill="#cdded8" opacity=".3" />
            <g filter={`url(#${paint})`}>
              <path d={leaf.pigment} fill="#cdded8" opacity=".9" />
              <path d={leaf.pigment} fill="#b9ceca" opacity=".26" transform="translate(-6 10)" />
              <path d={leaf.pigment} fill="#fdfaf3" opacity=".2" transform="translate(12 -10)" />
              <path d={leaf.pigment} fill={`url(#${patches})`} />
            </g>
          </g>
          <path
            d={leaf.shape}
            stroke={`url(#${gold})`}
            strokeWidth="1.85"
            strokeOpacity=".95"
            strokeLinejoin="round"
            filter={`url(#${edge})`}
          />
          <path
            d={leaf.vein}
            stroke={`url(#${gold})`}
            strokeWidth="1.35"
            strokeOpacity=".85"
            strokeLinecap="round"
            filter={`url(#${edge})`}
          />
        </g>
      ))}
      <g fill="#aab4cf" opacity=".36">
        <path d="M359 52Q361 45 369 50T376 60Q371 67 363 61Z" />
        <path d="M371 112Q381 105 391 114L397 126Q392 137 381 133Q367 131 371 112Z" />
        <path d="M695 115Q702 109 709 117Q711 128 703 130Q695 129 695 115Z" />
        <path d="M715 358Q725 347 733 358Q738 368 728 380Q717 385 711 375Z" />
      </g>
    </svg>
  );
}
