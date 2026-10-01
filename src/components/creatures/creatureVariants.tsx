import type { ReactNode } from "react";
import type { Species } from "../../domain/game";

// Stable, authored palettes: artwork must never depend on the battle seed or card ID.
export const palettes: Record<Species, [string, string]> = {
  viper: ["#b3a1c5", "#ebc194"],
  wolf: ["#d5dfc3", "#718f89"],
  deer: ["#dabd83", "#f5e0aa"],
  owl: ["#b7abd7", "#efe0bb"],
  beetle: ["#9cb8b0", "#d3e1d1"],
  moth: ["#c9b8db", "#9278a8"],
  fox: ["#e3a46f", "#f7d7a2"],
  bear: ["#ba9676", "#e6c49b"],
  heron: ["#c8dddd", "#8eafcc"],
  goat: ["#8e91ad", "#d9c8e2"],
  experiment: ["#b9cea2", "#daa5bc"],
  mouse: ["#c4b599", "#eed8b5"],
  rabbit: ["#eed7bd", "#c69b9a"],
  coyote: ["#d4b16e", "#f5d6a0"],
  greywolf: ["#a9bdcf", "#e6eff0"],
  hyena: ["#c6a66d", "#735e4c"],
  boar: ["#b99b87", "#f3dfb3"],
  hedgehog: ["#c5af83", "#ede0b6"],
  bat: ["#a99bc5", "#d7b6d0"],
  fawn: ["#dcac83", "#fff0ce"],
  chick: ["#f0d585", "#ffeabc"],
  sparrow: ["#bd9c7c", "#ead6ae"],
  crow: ["#869bab", "#bfd2de"],
  vulture: ["#bdac98", "#e5b1a1"],
  hen: ["#e3c7a1", "#d88779"],
  falcon: ["#b1c4ca", "#677e8e"],
  albatross: ["#ecdfc1", "#8ebbbb"],
  eagle: ["#d9b55f", "#f9dfa1"],
  pigeon: ["#a9b7d7", "#a0d6b9"],
  quail: ["#b9a780", "#f1d7a3"],
  ant: ["#c9aa8b", "#efc99e"],
  firefly: ["#b4cd79", "#f3eb7e"],
  mayfly: ["#a6d8d1", "#e8f1ca"],
  worker: ["#c58f68", "#f0c783"],
  caterpillar: ["#aacd83", "#e4eaaa"],
  mantis: ["#8ccc9b", "#d5eead"],
  queen: ["#e4bc62", "#fff0bc"],
  cricket: ["#a2b782", "#dce6ae"],
  ladybug: ["#de8f7d", "#523f40"],
  cicada: ["#92bdb0", "#d6e9ce"],
  gecko: ["#d4c393", "#f1e2b9"],
  turtle: ["#98c2ae", "#d9e3a6"],
  snake: ["#a9ce86", "#e8db81"],
  lizard: ["#a6b57d", "#d6d99f"],
  tortoise: ["#bfa577", "#e5cb91"],
  chameleon: ["#95c9b7", "#cd9dc5"],
  python: ["#c9ad72", "#796b49"],
  crocodile: ["#88a38d", "#c2c997"],
  skink: ["#a4bdcf", "#f5d69b"],
  iguana: ["#a2c18c", "#dec177"],
  spiderling: ["#c0c7db", "#e4d9ef"],
  orbweaver: ["#d0b77e", "#fae3a6"],
  venomspider: ["#af99c7", "#f1a2a6"],
  wolfspider: ["#b39580", "#ead1b0"],
  squirrel: ["#d5af7f", "#f0d4ac"],
  youngRabbit: ["#f3e5d6", "#dcb5be"],
  larva: ["#dae0ac", "#adbd80"],
  egg: ["#e7dfc2", "#b1c8b3"],
  butterfly: ["#dbacc5", "#f6d797"],
  bee: ["#d9c876", "#eee4a8"],
  tailToken: ["#aec294", "#e5d8a6"],
};

export const variants: Partial<Record<Species, ReactNode>> = {
  viper: <path className="outline-mark" d="m45 42 11 4-3 12 18 3-2 12 16 4-7 13" />,
  coyote: (
    <>
      <path d="M29 41 23 8 48 36M74 35 99 7 89 52" />
      <path className="marking" d="m48 67 12 5 12-5-12 22Z" />
    </>
  ),
  greywolf: (
    <>
      <path className="marking" d="M37 39 57 55 83 37 72 60 59 69 46 60Z" />
      <path className="outline-mark" d="m34 70-8 11m57-14 9 12" />
    </>
  ),
  hyena: (
    <>
      <path d="m41 38 8-24 8 8 8-14 7 23" />
      <circle cx="31" cy="34" r="12" />
      <circle cx="88" cy="31" r="12" />
      <g className="marking">
        <circle cx="44" cy="68" r="4" />
        <circle cx="75" cy="69" r="5" />
        <circle cx="63" cy="88" r="3" />
      </g>
    </>
  ),
  boar: (
    <>
      <ellipse cx="60" cy="73" rx="22" ry="15" className="marking" />
      <circle cx="52" cy="73" r="4" className="eye" />
      <circle cx="68" cy="73" r="4" className="eye" />
      <path d="M40 81Q19 72 29 55l4 17ZM80 81q21-9 11-26l-4 17Z" className="marking" />
    </>
  ),
  fawn: (
    <>
      <path className="marking" d="M44 74h7v7h-7zm22 0h7v7h-7z" />
    </>
  ),
  chick: (
    <>
      <path d="m54 25-5-15 12 9 10-12 2 18" />
      <ellipse cx="49" cy="69" rx="18" ry="15" className="marking" />
    </>
  ),
  sparrow: (
    <>
      <path className="marking" d="m52 31 24-10 10 10-26 7ZM27 74l33-14-12 20Z" />
      <path className="outline-mark" d="m42 86 15-12" />
    </>
  ),
  crow: (
    <>
      <path d="m86 32 29 4-26 17-9-8Z" />
      <path className="marking" d="m23 80 39-29-15 31-22 10Z" />
    </>
  ),
  vulture: (
    <>
      <path className="marking" d="m65 45 20-6-5 16-20 7Z" />
      <path d="M74 19q-10-14-18 0l-1 27 12 4 1-24Z" />
      <path className="outline-mark" d="m35 74 26-6m-20 15 20-7" />
    </>
  ),
  hen: (
    <>
      <path
        className="marking"
        d="M54 24q-12-22 0-19 8-13 14 0 16-8 9 12ZM86 45q10 17-2 21-11-7-3-17Z"
      />
      <path d="M24 77 10 43 34 56 27 29 48 60Z" />
    </>
  ),
  falcon: (
    <>
      <path d="m28 72-17-30 44 14-2 19Z" />
      <path className="marking" d="m68 38 12 2-10 19Z" />
      <path className="outline-mark" d="m38 77 20-12m-15 20 22-13" />
    </>
  ),
  albatross: (
    <>
      <path d="M64 64 7 25l17 44 26 12ZM72 63l39-34-8 41-28 11Z" />
      <path className="marking" d="m7 25 17 44 9 4-9-30Zm104 4-8 41-9 4 3-30Z" />
    </>
  ),
  eagle: (
    <>
      <path d="M57 57 5 20l17 53 30 13ZM71 57l42-40-8 51-32 20Z" />
      <path className="marking" d="m52 24 20-12 17 20-12 10-20-5Z" />
      <circle cx="74" cy="30" r="4" className="eye" />
    </>
  ),
  pigeon: (
    <>
      <path className="marking" d="m49 43 34 1-6 13-30-5Z" />
      <path className="outline-mark" d="m28 76 25-9m-23 17 23-9" />
    </>
  ),
  quail: (
    <>
      <ellipse cx="51" cy="72" rx="31" ry="24" />
      <g className="marking">
        <path d="m67 19 8-15 7 5-8 13Z" />
        <circle cx="36" cy="66" r="3" />
        <circle cx="50" cy="60" r="3" />
        <circle cx="64" cy="70" r="3" />
        <circle cx="42" cy="82" r="3" />
        <circle cx="58" cy="85" r="3" />
      </g>
    </>
  ),
  firefly: (
    <>
      <ellipse cx="60" cy="81" rx="19" ry="14" className="marking" />
      <path className="outline-mark" d="M28 83h-9m81 0h-9M60 103v8" />
    </>
  ),
  worker: (
    <>
      <path className="marking" d="m38 67 22-10 22 10v24l-22 12-22-12Z" />
      <path className="outline-mark" d="m38 67 22 12 22-12M60 79v24" />
    </>
  ),
  mantis: (
    <>
      <path d="m38 26 44 0-22 25Z" />
      <path className="outline-mark" d="M47 55 22 33 14 65 33 53M73 55l25-22 8 32-19-12" />
    </>
  ),
  queen: (
    <>
      <path className="marking" d="m41 21-4-17 17 9 6-13 7 13 16-9-4 17Z" />
      <path className="outline-mark" d="M21 51 10 43m89 8 11-8" />
    </>
  ),
  cricket: (
    <>
      <path d="m40 62-24-8 10 41-17 13 29-6-9-35ZM80 62l24-8-10 41 17 13-29-6 9-35Z" />
      <path className="outline-mark" d="M49 28 23 4m47 24L96 4" />
    </>
  ),
  ladybug: (
    <g className="marking">
      <circle cx="48" cy="55" r="6" />
      <circle cx="73" cy="56" r="6" />
      <circle cx="48" cy="76" r="5" />
      <circle cx="72" cy="77" r="5" />
    </g>
  ),
  cicada: (
    <>
      <path className="marking" d="m53 40-18 62 21-18 4-37 5 37 20 18-18-62Z" />
      <path className="outline-mark" d="M34 33 52 54M86 33 68 54" />
    </>
  ),
  gecko: (
    <g className="marking">
      {[
        [16, 47],
        [106, 62],
        [18, 80],
        [92, 85],
      ].map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r="7" />
      ))}
      <circle cx="62" cy="44" r="4" />
      <circle cx="57" cy="63" r="4" />
    </g>
  ),
  tortoise: (
    <>
      <path className="marking" d="m60 33 21 16v31L60 97 39 80V49Zm0 12-12 9v20l12 11 12-11V54Z" />
      <path className="outline-mark" d="M30 55h12m36 0h12M28 72h13m38 0h13" />
    </>
  ),
  chameleon: (
    <>
      <path d="M44 77C-2 67 12 119 40 104 59 92 26 77 27 95" className="outline-mark" />
      <path d="m65 27 5-22 20 15Z" />
      <circle cx="83" cy="26" r="10" className="marking" />
      <circle cx="85" cy="25" r="4" className="eye" />
    </>
  ),
  python: (
    <>
      <path
        className="outline-mark"
        d="m43 43 18-7m-7 21 12-9m7 18 15-6m-4 19 13 4m-28 4 3 12m-22-9-3 10"
      />
    </>
  ),
  crocodile: (
    <>
      <path d="m68 22 42-9 5 11-26 25-20-8ZM45 49l-10 2 8 9-10 8 10 5-10 9 13-1Z" />
      <path className="marking" d="m89 31 6 0-2 6 7-5 3 2-15 10Z" />
      <circle cx="82" cy="24" r="4" className="eye" />
    </>
  ),
  skink: <path className="outline-mark" d="M73 37 58 65 34 95M83 39 69 69 45 92" />,
  iguana: (
    <>
      <path className="marking" d="m58 29-13-5 6 17-14-2 8 16-13 2 10 12-13 5 12 6 15-25Z" />
      <path d="m78 40 7 23-19-10Z" />
    </>
  ),
  spiderling: (
    <>
      <circle cx="60" cy="73" r="13" className="marking" />
    </>
  ),
  orbweaver: (
    <>
      <path className="marking" d="m60 49 13 21-13 25-13-25Z" />
      <path className="outline-mark" d="M38 67h-9m53 0h9" />
    </>
  ),
  venomspider: (
    <>
      <path className="marking" d="m49 57 22 0-11 16 11 16H49l11-16Z" />
      <path d="m49 45 3 15 5-13m6 0 5 13 3-15" />
    </>
  ),
  wolfspider: (
    <>
      <path className="marking" d="M56 46h8v51h-8Z" />
      <path
        className="outline-mark"
        d="m22 33-8-3m11 23-9-5m9 32-10 4m83-51 8-3m-11 23 9-5m-9 32 10 4"
      />
    </>
  ),
  youngRabbit: (
    <>
      <ellipse cx="60" cy="81" rx="16" ry="12" className="marking" />
    </>
  ),
  larva: (
    <>
      <path className="outline-mark" d="m35 64 6 20m15-29 7 20m14-32 6 20" />
    </>
  ),
  butterfly: (
    <>
      <path
        className="marking"
        d="m20 25 30 23-25 7ZM100 25 70 48l25 7ZM34 78l17-8-12 18Zm52 0-17-8 12 18Z"
      />
    </>
  ),
};

// Different body plans get their own silhouette, rather than recolouring an unrelated animal.
export const silhouettes: Partial<Record<Species, ReactNode>> = {
  hedgehog: (
    <>
      <path d="m13 74 1-22 12 6 2-23 14 13 7-26 13 20 17-20 6 28 20-4-8 24 16 16-23 11H32Z" />
      <path d="m63 61 39 18-26 17H39Z" className="marking" />
      <circle cx="83" cy="77" r="4" className="eye" />
      <circle cx="104" cy="82" r="5" className="eye" />
    </>
  ),
  bat: (
    <>
      <path d="M55 51 12 21 5 72q15-14 25 5 14-11 24 12h12q9-23 24-12 10-19 25-5l-7-51-43 30-2-21-9 12-9-12Z" />
      <path className="outline-mark" d="M12 21 40 58 30 77m78-56L80 58l10 19" />
      <circle cx="55" cy="55" r="3" className="eye" />
      <circle cx="65" cy="55" r="3" className="eye" />
    </>
  ),
  mayfly: (
    <>
      <path d="M55 47Q8 9 13 54l42 12ZM65 47q47-38 42 7L65 66Z" />
      <path className="outline-mark" d="M60 24v64m0-2-16 25m16-25 16 25M54 26 42 12m24 14 12-14" />
      <ellipse cx="60" cy="50" rx="6" ry="29" />
    </>
  ),
  fawn: (
    <>
      <path d="m43 40 17-10 17 10 19-7-8 23-12 2-4 29-12 16-12-16-4-29-12-2-8-23Z" />
      <circle cx="49" cy="61" r="5" className="eye" />
      <circle cx="71" cy="61" r="5" className="eye" />
      <path d="m55 84 10 0-5 7Z" className="eye" />
    </>
  ),
  tailToken: (
    <>
      <path d="M24 25Q100 23 96 75 92 110 39 105q42-20 36-39-7-18-49-15Z" />
      <path className="outline-mark" d="m35 30-2 16m18-12-4 16m21-11-6 15m19 1-9 9m14 8-10 2" />
    </>
  ),
};
