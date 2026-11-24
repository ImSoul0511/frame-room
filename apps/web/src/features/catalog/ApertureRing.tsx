import { useId, type RefObject } from 'react';
import { genres } from '@frameroom/shared';
import { useStrings } from '../../lib/i18n';
import { PIGMENT_PATCHES } from '../../components/botanical-art';

const BLADE_COLORS = ['#aab4cf', '#cdded8', '#c0b8d3', '#91a8b5', '#d6d5e4', '#b6c9c4'];
const CORE_LIGHTS = [
  [425, 341, 3.2],
  [440, 349, 2.5],
  [417, 357, 2],
  [451, 367, 3.4],
  [434, 379, 2.2],
  [409, 388, 2.7],
  [461, 391, 2],
  [443, 407, 3.1],
  [420, 420, 1.8],
  [457, 432, 2.4],
  [389, 359, 1.5],
  [393, 409, 1.7],
] as const;

export function ApertureRing({ innerRef }: { innerRef?: RefObject<SVGGElement | null> }) {
  const t = useStrings();
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 800 800" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#d7d1e6" />
          <stop offset=".55" stopColor="#bdb9d2" />
          <stop offset="1" stopColor="#e2dce9" />
        </linearGradient>
        <path id={`${id}-blade`} d="M400 89A311 311 0 0 1 669 244L519 463Q554 264 400 89Z" />
        <clipPath id={`${id}-blade-clip`}>
          <use href={`#${id}-blade`} />
        </clipPath>
        <filter
          id={`${id}-blade-wash`}
          x="-8%"
          y="-8%"
          width="116%"
          height="116%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".03 .045"
            numOctaves="3"
            seed="8"
            result="grain"
          />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="6" result="paint" />
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 .4 .35 .25 0 .23"
            result="paper"
          />
          <feComposite in="paint" in2="paper" operator="in" />
        </filter>
        <filter id={`${id}-bokeh`}>
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
        <radialGradient id={`${id}-core`} cx=".4" cy=".35" r=".7">
          <stop stopColor="#ebe5ec" />
          <stop offset=".48" stopColor="#b6c4d4" />
          <stop offset="1" stopColor="#92a9b8" />
        </radialGradient>
        <radialGradient id={`${id}-light`}>
          <stop stopColor="#fdfaf3" stopOpacity=".8" />
          <stop offset="1" stopColor="#fdfaf3" stopOpacity="0" />
        </radialGradient>
        <filter
          id={`${id}-watercolor`}
          x="-15%"
          y="-15%"
          width="130%"
          height="130%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".022 .04"
            numOctaves="3"
            seed="12"
            result="grain"
          />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="15" result="paint" />
          <feGaussianBlur in="paint" stdDeviation="3" result="wash" />
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 .35 .35 .3 0 .25"
            result="paper"
          />
          <feComposite in="wash" in2="paper" operator="in" />
        </filter>
        <clipPath id={`${id}-core-clip`}>
          <path d="M519 463Q534 379 514 298Q449 273 395 285Q315 294 281 337Q266 421 286 502Q351 527 405 515Q485 506 519 463Z" />
        </clipPath>
        <pattern id={`${id}-pigment`} width="96" height="84" patternUnits="userSpaceOnUse">
          {PIGMENT_PATCHES.map((patch) => (
            <path
              key={patch.shape}
              d={patch.shape}
              fill={
                patch.ink === 'paper' ? '#fdfaf3' : patch.ink === 'sage' ? '#cdded8' : '#8e9fbb'
              }
              opacity={patch.opacity * 1.5}
            />
          ))}
        </pattern>
      </defs>
      <circle cx="400" cy="400" r="393" stroke="#d6b79c" strokeWidth="1" />
      <circle cx="400" cy="400" r="375" fill={`url(#${id}-rim)`} stroke="#8d98a9" />
      {Array.from({ length: 96 }, (_, index) => (
        <path
          key={index}
          d={`M400 ${index % 8 === 0 ? 14 : 20}V${index % 8 === 0 ? 38 : 29}`}
          stroke="#7b879f"
          strokeWidth={index % 8 === 0 ? 1.5 : 0.75}
          transform={`rotate(${index * 3.75} 400 400)`}
        />
      ))}
      <circle cx="400" cy="400" r="322" fill="#fdfaf3" stroke="#a7afc0" />
      <g clipPath={`url(#${id}-core-clip)`}>
        <g ref={innerRef}>
          <circle cx="400" cy="400" r="260" fill={`url(#${id}-core)`} />
          <g filter={`url(#${id}-watercolor)`}>
            <path
              d="M207 404C269 340 271 233 381 249C452 259 476 350 426 395C362 453 318 520 229 502Z"
              fill="#aac8c4"
              opacity=".9"
            />
            <path
              d="M355 236C446 206 567 285 558 379C549 473 447 484 399 417C355 356 298 321 355 236Z"
              fill="#a99bc5"
              opacity=".85"
            />
            <path
              d="M280 473C318 397 374 382 440 432C503 481 548 465 568 535L350 596Z"
              fill="#819fb4"
              opacity=".85"
            />
            <path
              d="M420 302C456 264 509 294 519 345C527 392 478 416 448 378C430 354 399 329 420 302Z"
              fill="#dbc5b7"
              opacity=".7"
            />
            <path
              d="M282 342C320 305 370 305 396 337C415 360 390 382 356 381C323 378 286 396 266 380Z"
              fill="#e2d2b4"
              opacity=".6"
            />
            <path
              d="M249 420C306 391 367 437 408 419C452 398 466 389 512 410C453 405 445 432 404 443C347 460 308 417 249 448Z"
              fill="#fdfaf3"
              opacity=".45"
            />
            <circle cx="400" cy="400" r="235" fill={`url(#${id}-pigment)`} />
          </g>
          <ellipse
            cx="365"
            cy="330"
            rx="95"
            ry="125"
            fill={`url(#${id}-light)`}
            transform="rotate(35 365 330)"
          />
          <g fill="#fff1ce" opacity=".65" filter={`url(#${id}-bokeh)`}>
            {CORE_LIGHTS.map(([x, y, radius]) => (
              <circle key={x} cx={x} cy={y} r={radius * 2.6} />
            ))}
          </g>
          <g fill="#fffdf2" opacity=".9">
            {CORE_LIGHTS.map(([x, y, radius]) => (
              <circle key={x} cx={x} cy={y} r={radius} />
            ))}
          </g>
        </g>
      </g>
      {BLADE_COLORS.map((color, index) => (
        <g key={color} transform={`rotate(${index * 60} 400 400)`}>
          <use href={`#${id}-blade`} fill="#fdfaf3" stroke="#fdfaf3" strokeWidth="6" />
          <g clipPath={`url(#${id}-blade-clip)`}>
            <use href={`#${id}-blade`} fill={color} opacity=".75" />
            <g filter={`url(#${id}-blade-wash)`}>
              <path
                d="M408 107Q492 133 514 218T626 290L550 409L483 325Q504 214 408 107Z"
                fill={color}
                opacity=".6"
              />
              <use href={`#${id}-blade`} fill={`url(#${id}-pigment)`} opacity=".6" />
              <path
                d="M429 139Q510 171 517 245Q526 292 568 321L532 364Q482 259 429 139Z"
                fill="#fdfaf3"
                opacity=".28"
              />
            </g>
          </g>
          <use href={`#${id}-blade`} fill="none" stroke="#c9ae88" strokeWidth="1.3" />
        </g>
      ))}
      <circle cx="400" cy="400" r="307" stroke="#d6b79c" />
      {genres.map((genre, index) => (
        <text
          key={genre}
          x="400"
          y="63"
          textAnchor="middle"
          fill="#485b76"
          fontSize="12"
          letterSpacing="2"
          transform={`rotate(${index * 30 + 90} 400 400)`}
        >
          {t.genreLabels[genre].toLocaleUpperCase()}
        </text>
      ))}
    </svg>
  );
}
