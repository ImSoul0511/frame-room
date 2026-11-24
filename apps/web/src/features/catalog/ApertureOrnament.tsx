import { useId } from 'react';
import { BotanicalSpray } from '../../components/BotanicalSpray';

export function ApertureOrnament() {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      className="aperture-ornament"
      viewBox="0 0 800 800"
      overflow="visible"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <filter id={`${id}-wash`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".025 .04"
            numOctaves="3"
            seed="9"
            result="grain"
          />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="17" />
        </filter>
      </defs>
      <g filter={`url(#${id}-wash)`} opacity=".32">
        <path
          d="M657 74Q718 87 753 155T806 275Q849 336 810 410Q840 449 805 506L748 537L661 120Z"
          fill="#beb4d5"
        />
        <path
          d="M711 582Q789 595 764 665Q748 706 698 732Q681 780 614 768Q557 829 492 797L507 744L711 582Z"
          fill="#bdced3"
        />
        <path d="M487 21Q528-12 570 22Q625 6 649 54L608 98L487 21Z" fill="#d2c7e1" />
      </g>
      <g transform="translate(580 -72) rotate(15 82 160) scale(.95)">
        <BotanicalSpray />
      </g>
      <g transform="translate(450 625) rotate(-35 82 160) scale(.85)">
        <BotanicalSpray />
      </g>
      <g
        className="aperture-turn-arrows"
        stroke="#667462"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M827 325Q818 269 789 225M789 225L791 243M789 225L806 232" />
        <path d="M826 475Q817 541 782 583M782 583L798 575M782 583L786 565" />
      </g>
      <path
        d="m782 390 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z"
        fill="#d4b573"
        stroke="#fdfaf3"
        strokeWidth="1"
      />
      <g fill="#b5adca" opacity=".55">
        <path d="M577 4Q594-7 599 10Q593 23 580 16Z" />
        <path d="M764 166Q779 158 780 173Q772 186 765 177Z" />
        <path d="M777 194Q784 190 787 200Q781 208 777 202Z" />
      </g>
    </svg>
  );
}
