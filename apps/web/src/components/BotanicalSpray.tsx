import { useId } from 'react';

const LEAVES = [
  { shape: 'M87 271C42 252 27 219 26 195C53 208 77 235 87 271Z', vein: 'M87 271Q54 235 31 204' },
  {
    shape: 'M88 247C116 211 141 202 162 203C149 229 124 245 88 247Z',
    vein: 'M88 247Q125 225 153 208',
  },
  { shape: 'M85 218C46 202 30 177 30 153C57 166 76 188 85 218Z', vein: 'M85 218Q53 183 35 161' },
  {
    shape: 'M89 191C109 157 132 144 153 143C145 166 122 185 89 191Z',
    vein: 'M89 191Q119 162 146 148',
  },
  { shape: 'M94 163C67 137 60 112 66 88C84 107 94 133 94 163Z', vein: 'M94 163Q74 119 69 99' },
  {
    shape: 'M100 139C115 106 134 91 151 89C145 111 128 130 100 139Z',
    vein: 'M100 139Q126 110 145 96',
  },
  { shape: 'M109 106C93 80 94 55 106 36C117 58 119 83 109 106Z', vein: 'M109 106Q105 68 107 47' },
] as const;

export function BotanicalSpray({
  className = '',
  flowers = true,
  blue = false,
}: {
  className?: string;
  flowers?: boolean;
  blue?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const ink = blue ? '#788c9c' : '#7f876c';
  return (
    <svg
      className={`botanical-spray ${className}`}
      width="180"
      height="320"
      viewBox="0 0 180 320"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id={`${id}-paper`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".045 .075"
            numOctaves="2"
            seed="6"
            result="grain"
          />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.8" />
        </filter>
        <path id={`${id}-petal`} d="M0 1C-8-3-12-13-7-16C-2-20 4-11 0 1Z" />
      </defs>
      <g filter={`url(#${id}-paper)`} stroke={ink} strokeLinecap="round" strokeLinejoin="round">
        <path d="M80 316C92 266 77 225 89 184C100 144 120 96 109 39" strokeWidth="1.2" />
        {LEAVES.map((leaf, index) => (
          <g key={leaf.shape}>
            <path
              d={leaf.shape}
              fill={blue ? '#c0cfd7' : index % 2 ? '#cbd5b9' : '#dbe0cc'}
              fillOpacity={index % 3 ? 0.62 : 0.82}
              strokeWidth=".9"
            />
            <path d={leaf.vein} strokeWidth=".55" opacity=".75" />
          </g>
        ))}
        {flowers ? (
          <>
            <path
              d="M83 298C53 245 59 212 47 181M91 253C124 202 117 135 139 114M92 202C64 159 47 120 43 103"
              strokeWidth=".85"
            />
            {[
              [47, 181, 1.1, 0],
              [139, 114, 0.85, 24],
              [43, 103, 0.8, -16],
            ].map(([x, y, scale, angle], index) => (
              <g key={x} transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
                {Array.from({ length: 5 }, (_, petal) => (
                  <use
                    key={petal}
                    href={`#${id}-petal`}
                    fill={index === 1 ? '#d7c4a4' : '#c7bbce'}
                    fillOpacity=".72"
                    stroke="#998a91"
                    strokeWidth=".75"
                    transform={`rotate(${petal * 72})`}
                  />
                ))}
                <circle r="2.6" fill="#d8bf91" strokeWidth=".5" />
              </g>
            ))}
          </>
        ) : null}
      </g>
    </svg>
  );
}
