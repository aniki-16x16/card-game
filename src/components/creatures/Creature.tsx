import type { ReactNode } from "react";
import type { Art, Species } from "../../domain/game";
import { palettes, variants, silhouettes } from "./creatureVariants";
import "./creatureVisuals.css";
export function Creature({
  species,
  art,
  small = false,
}: {
  species: Species;
  art: Art;
  small?: boolean;
}) {
  const shapes: Record<Art, ReactNode> = {
    mouse: (
      <>
        <circle cx="35" cy="30" r="18" />
        <circle cx="85" cy="30" r="18" />
        <path d="M30 44Q60 25 90 44L79 82 60 100 41 82Z" />
        <circle cx="44" cy="57" r="4" className="eye" />
        <circle cx="76" cy="57" r="4" className="eye" />
        <path d="m54 80 12 0-6 8Z" className="eye" />
      </>
    ),
    rabbit: (
      <>
        <ellipse cx="42" cy="28" rx="11" ry="25" />
        <ellipse cx="78" cy="28" rx="11" ry="25" />
        <ellipse cx="60" cy="70" rx="32" ry="30" />
        <circle cx="46" cy="64" r="5" className="eye" />
        <circle cx="74" cy="64" r="5" className="eye" />
        <path d="m54 79 12 0-6 8Z" className="eye" />
      </>
    ),
    bird: (
      <>
        <path d="M19 73 48 48 53 25 72 15 89 32 111 40 86 48 79 72 59 93 25 89Z" />
        <path d="m22 73 46-22-9 33Z" className="shade" />
        <circle cx="74" cy="32" r="4" className="eye" />
        <path d="m55 90-5 18m17-22 4 22" stroke="currentColor" strokeWidth="4" />
      </>
    ),
    ant: (
      <>
        <path
          d="M48 27 31 10m41 17 17-17M42 53 16 36m27 27L14 69m31 6L27 103m51-50 26-17M77 63l29 6M75 75l18 28"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
        />
        <circle cx="60" cy="33" r="18" />
        <ellipse cx="60" cy="61" rx="13" ry="15" />
        <ellipse cx="60" cy="87" rx="21" ry="21" />
        <circle cx="52" cy="30" r="3" className="eye" />
        <circle cx="68" cy="30" r="3" className="eye" />
      </>
    ),
    caterpillar: (
      <>
        <circle cx="26" cy="76" r="15" />
        <circle cx="47" cy="69" r="19" />
        <circle cx="69" cy="62" r="20" />
        <circle cx="87" cy="44" r="23" />
        <path
          d="m79 23-7-15m23 17 9-13M24 88v13m23-16v16m21-22v18"
          stroke="currentColor"
          strokeWidth="4"
        />
        <circle cx="91" cy="40" r="5" className="eye" />
      </>
    ),
    bee: (
      <>
        <ellipse cx="39" cy="38" rx="21" ry="27" />
        <ellipse cx="81" cy="38" rx="21" ry="27" />
        <ellipse cx="60" cy="67" rx="24" ry="32" />
        <path d="M38 55h44M36 70h48M41 85h38" stroke="#172b24" strokeWidth="7" />
        <circle cx="60" cy="30" r="16" />
        <circle cx="54" cy="28" r="3" className="eye" />
        <circle cx="66" cy="28" r="3" className="eye" />
      </>
    ),
    snake: (
      <>
        <path d="M83 18Q34 7 35 43q0 18 30 22 25 4 15 18-9 13-45 5L14 98q65 29 83-13 9-27-33-38-16-5-8-11l28 2 18-10Z" />
        <circle cx="80" cy="24" r="4" className="eye" />
        <path d="m101 28 13 4m-3-1 4-7" stroke="currentColor" strokeWidth="3" />
      </>
    ),
    turtle: (
      <>
        <circle cx="60" cy="18" r="12" />
        <path d="m31 38-18-7 3 20 16 6m56-19 18-7-3 20-16 6M30 81 18 101l22-4m50-16 12 20-22-4" />
        <ellipse cx="60" cy="65" rx="36" ry="38" />
        <path d="m60 35 20 15v29L60 96 40 79V50Z" className="shade" />
        <path d="M40 50 25 46m55 4 15-4M40 79 25 85m55-6 15 6" stroke="#172b24" strokeWidth="3" />
      </>
    ),
    lizard: (
      <>
        <path d="M76 12 94 19l4 15-19 10-12 26Q59 99 21 106L43 79 48 49 57 26Z" />
        <path
          d="m52 46-22-9-15 10m54 11 28 11 10-6M48 75 28 71 17 80m43-1 22 14 10-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
        />
        <circle cx="81" cy="24" r="4" className="eye" />
      </>
    ),
    spider: (
      <>
        <path
          d="m44 49-22-18-4-18m24 44L15 51 8 36m36 33L16 77 9 96m36-19-18 25 2 11m47-64 22-18 4-18M78 57l27-6 7-15M76 69l28 8 7 19M75 77l18 25-2 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
        />
        <ellipse cx="60" cy="73" rx="23" ry="29" />
        <circle cx="60" cy="38" r="17" />
        <circle cx="53" cy="35" r="4" className="eye" />
        <circle cx="67" cy="35" r="4" className="eye" />
      </>
    ),
    egg: (
      <>
        <path d="M25 76C25 43 45 12 60 12s35 31 35 64c0 40-70 40-70 0Z" />
        <path d="m30 62 17 8 14-17 15 13 15-5" fill="none" stroke="#172b24" strokeWidth="4" />
      </>
    ),
    goat: (
      <>
        <path
          d="M43 42Q12 24 29 7L39 31M77 42Q108 24 91 7L81 31"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
        />
        <path d="m40 38 20-7 20 7 13 12-16 5-5 29-12 19-12-19-5-29-16-5Z" />
        <path d="m48 70 12 8 12-8-12 30Z" className="shade" />
        <path d="m43 51 13 3-6 6Zm21 3 13-3-7 9Z" className="eye" />
      </>
    ),
    experiment: (
      <>
        <path d="M37 29 30 12l20 10 20-1 19-10-6 21 11 19-9 33-25 17-27-16-8-33Z" />
        <path d="m60 25-8 18 14 17-12 17 8 21" fill="none" stroke="#172b24" strokeWidth="4" />
        <circle cx="43" cy="49" r="8" className="eye" />
        <circle cx="76" cy="51" r="5" className="eye" />
        <path
          d="m41 77 36-4m-29-5 1 16m10-17 1 16m10-18 1 16"
          fill="none"
          stroke="#172b24"
          strokeWidth="3"
        />
      </>
    ),
    squirrel: (
      <>
        <path d="M70 80C108 87 115 44 94 23 78 9 65 24 77 38c20 16 15 31-2 27Z" />
        <path d="m37 39-3-23 17 14 14 4 8 15-11 15 10 22-12 13H29l5-16 8-19-15-9Z" />
        <path d="M45 64q23 8 14 26H37Z" className="shade" />
        <circle cx="49" cy="44" r="4" className="eye" />
        <path d="m27 51 9 1-4 6Z" className="eye" />
        <path d="m57 72 15-4-5 13-10-1Z" className="shade" />
      </>
    ),
    wolf: (
      <>
        <path d="M38 51 28 17 53 35 67 32 91 14 85 54 71 84 58 98 43 78Z" />
        <path d="m38 51 18 12 29-9-15 22-12 22-3-24Z" className="shade" />
        <path d="m40 53 12 4-5 6Zm28 4 13-7-7 12Z" className="eye" />
        <path d="m53 78 11-2-6 8Z" className="eye" />
      </>
    ),
    fox: (
      <>
        <path d="m28 16 29 21 30-21-5 43-23 35-26-31Z" />
        <path d="m33 60 24 8 25-11-23 37Z" className="shade" />
        <path d="m37 50 13 7-8 3Zm29 7 13-9-5 12Z" className="eye" />
        <path d="m54 78 10-1-5 8Z" className="eye" />
      </>
    ),
    deer: (
      <>
        <path
          d="m49 46-9-17-13-7-4-15M38 27 40 9M29 23 16 27M70 46l9-17 13-7 5-15M81 27 80 9M91 23l13 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
        />
        <path d="m44 44 15-7 15 7 2 28-17 25-17-25-17-23Z" />
        <path d="m74 44 22 5-21 17M44 45 21 49l22 17" />
        <path d="m47 60 8 2-3 5Zm17 2 8-2-4 7Z" className="eye" />
      </>
    ),
    owl: (
      <>
        <path d="m30 23 20 9 20-1 20-10-3 44-13 24-15 9-24-21-9-27Z" />
        <path d="M29 40q17-16 30 8 16-23 31-7L75 68H43Z" className="shade" />
        <circle cx="44" cy="48" r="6" className="eye" />
        <circle cx="75" cy="48" r="6" className="eye" />
        <path d="m54 59 11 0-6 12Z" className="eye" />
        <path d="m44 76 15 8 14-9" fill="none" stroke="#172b24" strokeWidth="3" />
      </>
    ),
    beetle: (
      <>
        <path
          d="m38 43-19-12m18 27-24 3m28 13L21 90m59-47 19-12M81 58l24 3M77 74l22 16M49 25 40 11m29 14 10-14"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
        />
        <ellipse cx="60" cy="59" rx="25" ry="34" />
        <path d="M60 27v66M37 47h46" fill="none" stroke="#1a3026" strokeWidth="3" />
        <path d="M45 34q15-27 30 0" />
      </>
    ),
    moth: (
      <>
        <path d="M55 43Q12 3 15 44q3 24 37 19Q19 69 31 96l26-22Zm10 0Q108 3 105 44q-3 24-37 19 33 6 21 33L63 74Z" />
        <path d="m57 33 7 0 3 46-7 17-6-18Z" className="shade" />
        <path d="M58 35 46 17m16 18 12-18" stroke="currentColor" strokeWidth="2" />
        <circle cx="34" cy="44" r="8" className="shade" />
        <circle cx="87" cy="44" r="8" className="shade" />
      </>
    ),
    bear: (
      <>
        <circle cx="32" cy="31" r="13" />
        <circle cx="86" cy="31" r="13" />
        <path d="m34 26 49 1 12 35-12 27-24 10-27-13-9-24Z" />
        <path d="m46 63 26-1 10 18-22 13-23-12Z" className="shade" />
        <path d="m49 69 21 0-10 12Z" className="eye" />
        <path d="m35 47 15 5-9 5Zm34 5 15-5-7 10Z" className="eye" />
      </>
    ),
    heron: (
      <>
        <path d="m75 19 12 13 22 7-27 5-9 21 5 16-33 11-26-22 26-8 17-8 3-20Z" />
        <path d="m24 69 42-9-20 24Z" className="shade" />
        <path d="M55 87 47 108m22-23 5 23" stroke="currentColor" strokeWidth="3" />
        <circle cx="78" cy="32" r="3" className="eye" />
      </>
    ),
  };
  const [color, accent] = palettes[species];
  return (
    <svg
      style={{ color, "--creature-accent": accent } as import("react").CSSProperties}
      viewBox="0 0 120 120"
      className={`creature ${species} ${small ? "small" : ""}`}
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="47" className="halo" />
      <path d="M9 60h102M60 10v100" className="guide" />
      <g
        className="silhouette"
        transform={
          species === "youngRabbit" || species === "spiderling"
            ? "translate(15 18) scale(.75)"
            : undefined
        }
      >
        {silhouettes[species] ?? shapes[art]}
        {variants[species]}
      </g>
    </svg>
  );
}
