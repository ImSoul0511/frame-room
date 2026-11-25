import { useId, type RefObject } from 'react';
import { genres } from '@frameroom/shared';
import { useStrings } from '../../lib/i18n';
import { PIGMENT_PATCHES } from '../../components/botanical-art';
import { bladePivot, GENRE_STEP } from './aperture-geometry';

const BLADE_COLORS = ['#aab4cf', '#cdded8', '#c0b8d3', '#91a8b5', '#d6d5e4', '#b6c9c4'];

export function ApertureRing({ bladeRef }: { bladeRef: RefObject<SVGPathElement | null> }) {
  const t = useStrings();
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 800 800" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#e0dbea" />
          <stop offset=".4" stopColor="#beb9cf" />
          <stop offset=".72" stopColor="#d1cbdc" />
          <stop offset="1" stopColor="#aaa4bd" />
        </linearGradient>
        <path
          id={`${id}-blade`}
          ref={bladeRef}
          transform={bladePivot(0)}
          d="M-350 -450H1150V486Q400 114 -350 486Z"
        />
        <clipPath id={`${id}-bore`}>
          <circle cx="400" cy="400" r="311" />
        </clipPath>
        {/* The next leaf overlaps this one. Clear its silhouette plus a narrow seam. */}
        <mask id={`${id}-seam`} maskUnits="userSpaceOnUse" x="0" y="0" width="800" height="800">
          <rect width="800" height="800" fill="white" />
          <use
            href={`#${id}-blade`}
            transform="rotate(60 400 400)"
            fill="black"
            stroke="black"
            strokeWidth="18"
          />
        </mask>
        <pattern id={`${id}-pigment`} width="96" height="84" patternUnits="userSpaceOnUse">
          {PIGMENT_PATCHES.map((patch) => (
            <path
              key={patch.shape}
              d={patch.shape}
              fill={
                patch.ink === 'paper' ? '#fdfaf3' : patch.ink === 'sage' ? '#cdded8' : '#8e9fbb'
              }
              opacity={patch.opacity * 0.7}
            />
          ))}
        </pattern>
      </defs>
      {/* The rim is an annulus so the opening shows the page through the blades. */}
      <path
        d="M400 25a375 375 0 1 1 0 750a375 375 0 1 1 0-750Z M400 89a311 311 0 1 1 0 622a311 311 0 1 1 0-622Z"
        fill={`url(#${id}-rim)`}
        fillRule="evenodd"
        stroke="#545772"
        strokeWidth="3"
      />
      <circle cx="400" cy="400" r="393" stroke="#947659" strokeWidth="2" />
      <circle cx="400" cy="400" r="372" stroke="#f4eef5" strokeWidth="2" />
      {Array.from({ length: 96 }, (_, index) => (
        <path
          key={index}
          d={`M400 ${index % 8 === 0 ? 14 : 20}V${index % 8 === 0 ? 38 : 29}`}
          stroke="#4d526e"
          strokeWidth={index % 8 === 0 ? 2.4 : 1.4}
          transform={`rotate(${index * 3.75} 400 400)`}
        />
      ))}
      <g clipPath={`url(#${id}-bore)`}>
        {BLADE_COLORS.map((color, index) => (
          <g key={color} transform={`rotate(${index * 60 + 24} 400 400)`} mask={`url(#${id}-seam)`}>
            <use href={`#${id}-blade`} fill={color} />
            <use
              href={`#${id}-blade`}
              fill={`url(#${id}-pigment)`}
              stroke="#616478"
              strokeWidth="2.2"
            />
          </g>
        ))}
      </g>
      <circle cx="400" cy="400" r="311" stroke="#58586f" strokeWidth="4" />
      <circle cx="400" cy="400" r="316" stroke="#f3edf4" strokeWidth="2" />
      {genres.map((genre, index) => (
        <text
          key={genre}
          x="400"
          y="64"
          textAnchor="middle"
          fill="#30374e"
          fontSize="18"
          fontWeight="600"
          letterSpacing="1.4"
          transform={`rotate(${index * GENRE_STEP + 90} 400 400)`}
        >
          {t.genreLabels[genre].toLocaleUpperCase()}
        </text>
      ))}
    </svg>
  );
}
