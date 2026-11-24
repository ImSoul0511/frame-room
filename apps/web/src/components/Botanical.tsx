import { useId } from 'react';
import { FLOWER_PETALS as PETALS, PIGMENT_PATCHES } from './botanical-art';
export { LeafBranch } from './LeafBranch';

function FlowerHead({ paint, texture, leaf }: { paint: string; texture: string; leaf: string }) {
  return (
    <g className="botanical-head">
      <g fill={`url(#${leaf})`} stroke="#d6b79c" strokeWidth="1" filter={`url(#${texture})`}>
        <path d="M0 8C-17-9-41-18-72-25C-40-12-19-1 0 8Z" />
        <path d="M0 8C23-13 54-19 91-14C53-4 21 2 0 8Z" />
      </g>
      <path d="M0 8L0 0" stroke="#d6b79c" strokeWidth="1.2" />
      {PETALS.map((petal, index) => (
        <g
          className="botanical-petal"
          style={{ animationDelay: `${index * -0.32}s` }}
          key={petal.layer}
        >
          <g filter={`url(#${texture})`}>
            <path d={petal.shape} fill={`url(#${paint}-${petal.layer})`} fillOpacity=".98" />
            <path d={petal.shape} fill={`url(#${paint}-pigment)`} />
          </g>
          <path
            d={'outline' in petal ? petal.outline : petal.shape}
            transform={`rotate(${petal.offset})`}
            fill="none"
            stroke="#d6b79c"
            strokeWidth="1.15"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={petal.vein}
            stroke="#d6b79c"
            strokeWidth=".85"
            strokeOpacity=".95"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
    </g>
  );
}

export function Botanical({
  className = '',
  meadow = false,
}: {
  className?: string;
  meadow?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const texture = `${id}-texture`;
  const blue = `${id}-blue`;
  const violet = `${id}-violet`;
  const leaf = `${id}-leaf`;
  return (
    <svg className={`botanical ${className}`} viewBox="0 0 360 430" fill="none" aria-hidden="true">
      <defs>
        <filter
          id={texture}
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".035 .065"
            numOctaves="3"
            seed="8"
            result="grain"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="grain"
            scale="3.2"
            xChannelSelector="R"
            yChannelSelector="G"
            result="paint"
          />
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 .15 .1 .05 0 .65"
            result="paper"
          />
          <feComposite in="paint" in2="paper" operator="in" />
        </filter>
        {PETALS.flatMap((petal) =>
          (['blue', 'violet'] as const).map((palette) => (
            <linearGradient
              key={`${palette}-${petal.layer}`}
              id={`${palette === 'blue' ? blue : violet}-${petal.layer}`}
              x1="5%"
              y1="5%"
              x2="85%"
              y2="100%"
            >
              <stop stopColor={petal[palette].color} stopOpacity={petal[palette].opacity} />
              <stop
                offset="1"
                stopColor={petal[palette].color}
                stopOpacity={petal[palette].opacity - 0.04}
              />
            </linearGradient>
          )),
        )}
        {(['blue', 'violet'] as const).map((palette) => (
          <pattern
            key={palette}
            id={`${palette === 'blue' ? blue : violet}-pigment`}
            width="96"
            height="84"
            patternUnits="userSpaceOnUse"
          >
            {PIGMENT_PATCHES.map((patch) => (
              <path
                key={patch.shape}
                d={patch.shape}
                opacity={patch.opacity}
                fill={
                  patch.ink === 'paper'
                    ? '#fcf9f2'
                    : patch.ink === 'sage'
                      ? '#b4c8c5'
                      : palette === 'blue'
                        ? '#54658c'
                        : '#8d83aa'
                }
              />
            ))}
          </pattern>
        ))}
        <linearGradient id={leaf} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop stopColor="#b4c8c5" stopOpacity=".35" />
          <stop offset=".45" stopColor="#b4c8c5" stopOpacity=".85" />
          <stop offset=".7" stopColor="#b4c8c5" stopOpacity=".42" />
          <stop offset="1" stopColor="#b4c8c5" stopOpacity=".72" />
        </linearGradient>
      </defs>
      {meadow ? (
        <g className="botanical-meadow" transform="translate(290 438)">
          {[
            { x: -17, y: -136, scale: 0.28, angle: -12 },
            { x: 39, y: -99, scale: 0.24, angle: 22 },
            { x: -48, y: -65, scale: 0.2, angle: -23 },
          ].map((flower, index) => (
            <g className={`botanical-sprig sprig-${index}`} key={flower.x}>
              <path
                d={`M0 0Q${flower.x * 0.25} ${flower.y * 0.55} ${flower.x} ${flower.y}`}
                stroke="#d6b79c"
                strokeWidth="1.1"
              />
              <path
                d={`M${flower.x * 0.25} ${flower.y * 0.55}q28-30 18-53q-24 14-18 53Z`}
                fill={`url(#${leaf})`}
                stroke="#d6b79c"
                strokeWidth=".8"
                filter={`url(#${texture})`}
              />
              <g
                transform={`translate(${flower.x} ${flower.y}) rotate(${flower.angle}) scale(${flower.scale})`}
              >
                <FlowerHead paint={violet} texture={texture} leaf={leaf} />
              </g>
            </g>
          ))}
        </g>
      ) : null}
      <g transform="translate(72 430)">
        <g className="botanical-stem">
          <path
            className="botanical-stalk"
            d="M0 0C14-52 40-98 62-130"
            stroke="#d6b79c"
            strokeWidth="1.5"
          />
          <g fill={`url(#${leaf})`} stroke="#d6b79c" strokeWidth="1" filter={`url(#${texture})`}>
            <path d="M37-89C-7-105-37-136-36-168C0-158 28-123 37-89Z" />
            <path d="M62-130C89-161 120-172 151-159C130-134 96-123 62-130Z" />
          </g>
          <g transform="translate(62 -130)">
            <g className="botanical-tip">
              <path
                className="botanical-stalk"
                d="M0 0C22-49 47-88 71-115"
                stroke="#d6b79c"
                strokeWidth="1.5"
              />
              <path d="M28-55C4-74-13-103-25-128" stroke="#d6b79c" strokeWidth="1.2" />
              <g
                fill={`url(#${leaf})`}
                stroke="#d6b79c"
                strokeWidth="1"
                filter={`url(#${texture})`}
              >
                <path d="M28-55C37-94 61-117 86-121C83-90 61-67 28-55Z" />
                <path d="M-25-128C-53-148-54-177-43-197C-23-183-16-155-25-128Z" />
              </g>
              <g className="botanical-main-head" transform="translate(71 -115)">
                <FlowerHead paint={blue} texture={texture} leaf={leaf} />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

export function WatercolorWash() {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      className="watercolor-wash"
      viewBox="0 0 1200 600"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <filter id={id} x="-15%" y="-30%" width="130%" height="160%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".018 .07"
            numOctaves="4"
            seed="6"
            result="texture"
          />
          <feDisplacementMap in="SourceGraphic" in2="texture" scale="22" />
          <feGaussianBlur stdDeviation=".5" />
        </filter>
      </defs>
      <g filter={`url(#${id})`}>
        <path
          className="watercolor-wash-left"
          d="M-80 410Q10 370 115 411T280 434L300 550Q128 590-80 550Z"
          fill="#aab4cf"
          opacity=".38"
        />
        <path
          d="M970 335Q1090 305 1270 335L1280 510Q1100 524 969 477Z"
          fill="#a9a0c8"
          opacity=".34"
        />
        <g fill="#a9a0c8" opacity=".28">
          <circle cx="878" cy="68" r="7" />
          <circle cx="915" cy="104" r="4" />
          <circle cx="842" cy="122" r="3" />
          <circle cx="934" cy="64" r="3" />
          <circle cx="225" cy="185" r="4" />
          <circle cx="249" cy="221" r="3" />
        </g>
      </g>
    </svg>
  );
}
