export const TRIBES = { beast: '兽类', bird: '鸟类', insect: '虫族', reptile: '爬行类', spider: '蛛类', special: '特殊生物' } as const
export type Tribe = keyof typeof TRIBES
export type Art = 'wolf' | 'deer' | 'owl' | 'beetle' | 'moth' | 'fox' | 'bear' | 'heron' | 'goat' | 'experiment' | 'mouse' | 'rabbit' | 'bird' | 'ant' | 'caterpillar' | 'bee' | 'lizard' | 'turtle' | 'snake' | 'spider' | 'squirrel' | 'egg'
export type Species = 'viper' | 'wolf' | 'deer' | 'owl' | 'beetle' | 'moth' | 'fox' | 'bear' | 'heron' | 'goat' | 'experiment' | 'mouse' | 'rabbit' | 'coyote' | 'greywolf' | 'hyena' | 'boar' | 'hedgehog' | 'bat' | 'fawn' | 'chick' | 'sparrow' | 'crow' | 'vulture' | 'hen' | 'falcon' | 'albatross' | 'eagle' | 'pigeon' | 'quail' | 'ant' | 'firefly' | 'mayfly' | 'worker' | 'caterpillar' | 'mantis' | 'queen' | 'cricket' | 'ladybug' | 'cicada' | 'gecko' | 'turtle' | 'snake' | 'lizard' | 'tortoise' | 'chameleon' | 'python' | 'crocodile' | 'skink' | 'iguana' | 'spiderling' | 'orbweaver' | 'venomspider' | 'wolfspider' | 'squirrel' | 'youngRabbit' | 'larva' | 'egg' | 'butterfly' | 'bee' | 'tailToken'
export type Sigil = 'ranged' | 'armor' | 'support' | 'thorns' | 'split' | 'rebirth' | 'triple' | 'undying' | 'flying' | 'breed' | 'hunt' | 'pack' | 'scavenge' | 'growth' | 'nest' | 'dive' | 'migrate' | 'shortlived' | 'porter' | 'metamorph' | 'double' | 'swarm' | 'poison' | 'tail' | 'stealth' | 'devour' | 'ambush' | 'web' | 'birdcatcher' | 'brood'
export type Card = { id: string; name: string; species: Species; tribe: Tribe; art: Art; attack: number; health: number; cost: number; native: Sigil[]; added: Sigil[]; capacity: number; token?: boolean }
export const SIGILS: Record<Sigil, { name: string; weight: number; description: string }> = {
  ranged: { name: '远射', weight: 1, description: '位于后排时也能攻击同列；目标前排为空时直接伤害对方玩家。' },
  armor: { name: '硬甲', weight: 1, description: '每次受到攻击时，伤害减少 1，最低为 0。反伤不受此影响。' },
  support: { name: '鼓舞', weight: 1, description: '位于后排时，使同列的友方前排攻击 +1。' },
  thorns: { name: '荆棘', weight: 1, description: '被攻击后，对攻击者造成 1 点伤害，即使自身死亡。' },
  split: { name: '分袭', weight: 2, description: '改为攻击左右相邻两列，不攻击正前方；边缘只攻击一列。' },
  triple: { name: '丰饶祭品', weight: 2, description: '献祭时提供 3 费，多出的费用不保留。' },
  undying: { name: '永续祭品', weight: 3, description: '献祭时不会死亡，保留位置、生命和印记；同一次召唤只能计费一次。被击杀时仍会死亡。' },
  rebirth: { name: '归魂', weight: 3, description: '死亡后返回手牌，献祭也会触发；再次召唤仍需支付费用。' },
  flying: {"name":"飞行","weight":2,"description":"从前排或后排攻击目标列的天空；该列没有未被结网压制的飞行单位时直接伤害玩家。地面攻击仍能命中前排飞行单位。"},
  breed: {"name":"繁育","weight":1,"description":"存活到下一回合开始时，将一张零费 0/1、无印记幼兔加入手牌；每次登场只触发一次。"},
  hunt: {"name":"围猎","weight":1,"description":"攻击已有损伤的单位时，攻击 +2。"},
  pack: {"name":"群猎","weight":2,"description":"在场时，相邻列的友方前排攻击 +1。"},
  scavenge: {"name":"食腐","weight":2,"description":"每当任意其他单位被击杀且自身存活，攻击 +1，持续到离场。献祭和自然死亡不触发。"},
  growth: {"name":"成长","weight":1,"description":"存活到下一回合开始时，攻击 +1 并获得飞行；每次登场只触发一次。"},
  nest: {"name":"筑巢","weight":1,"description":"登场时，在同列空后排放置一枚 0/1 的蛋，下回合开始孵化为雏鸟。自身位于后排或后排被占时不放置。"},
  dive: {"name":"俯冲","weight":2,"description":"优先攻击目标列非飞行的后排单位；没有时按自身正常路线攻击。"},
  migrate: {"name":"迁徙","weight":1,"description":"完成攻击后移动到同排相邻空列，优先右侧，再尝试左侧。"},
  shortlived: {"name":"短命","weight":1,"description":"完成一次行动的全部攻击后自然死亡，可触发归魂；不算被击杀。"},
  porter: {"name":"搬运","weight":1,"description":"登场时，将一张零费 1/1、无印记蚂蚁加入手牌。"},
  metamorph: {"name":"蜕变","weight":2,"description":"存活到第二次新回合开始时，变为 3/3、带飞行的蝶，保留其他印记并恢复生命。"},
  double: {"name":"连击","weight":2,"description":"连续攻击两轮，每轮重新判断目标；与分袭叠加时每轮攻击左右两列。"},
  swarm: {"name":"蜂群","weight":2,"description":"受到攻击（包括硬甲格挡）且存活后，将一张零费 1/1、带飞行和短命的蜂加入手牌。"},
  poison: {"name":"剧毒","weight":2,"description":"对单位造成至少 1 点攻击伤害后将其击杀；毒杀不额外制造溢出伤害。"},
  tail: {"name":"断尾","weight":1,"description":"首次受到致命攻击或反伤时保留 1 血，失去此印记，将一张零费 0/1 尾巴加入手牌。献祭和短命不触发。"},
  stealth: {"name":"潜伏","weight":1,"description":"每次登场后的第一轮攻击伤害翻倍；与分袭叠加时该轮两列均翻倍。"},
  devour: {"name":"吞食","weight":2,"description":"击杀单位后，按其基础生命恢复自身生命，不超过上限。自身同时死亡时不恢复。"},
  ambush: {"name":"伏击","weight":2,"description":"位于前排时，敌方单位部署到同列前排后立即攻击一轮。"},
  web: {"name":"结网","weight":1,"description":"在场时，使同列敌方单位的飞行失效；离场后恢复。"},
  birdcatcher: {"name":"捕鸟","weight":1,"description":"攻击拥有飞行印记的单位时，攻击 +2，包括飞行被结网压制的单位。"},
  brood: {"name":"遗卵","weight":1,"description":"死亡时将一张零费 0/1、无印记幼虫加入手牌；献祭也会触发。"},
}
export const templates: Omit<Card, 'id' | 'added'>[] = [
  {"species":"wolf","name":"苔原狼","tribe":"beast","cost":2,"attack":3,"health":3,"native":[],"art":"wolf","capacity":3},
  {"species":"deer","name":"枝角鹿","tribe":"beast","cost":2,"attack":1,"health":4,"native":["support"],"art":"deer","capacity":3},
  {"species":"owl","name":"夜巡鸮","tribe":"bird","cost":2,"attack":2,"health":2,"native":["ranged"],"art":"owl","capacity":3},
  {"species":"beetle","name":"铁背甲虫","tribe":"insect","cost":1,"attack":1,"health":2,"native":["armor"],"art":"beetle","capacity":3},
  {"species":"moth","name":"归魂蛾","tribe":"insect","cost":1,"attack":1,"health":1,"native":["rebirth"],"art":"moth","capacity":3},
  {"species":"fox","name":"赤尾狐","tribe":"beast","cost":1,"attack":2,"health":1,"native":[],"art":"fox","capacity":3},
  {"species":"bear","name":"山脊熊","tribe":"beast","cost":3,"attack":5,"health":6,"native":["thorns"],"art":"bear","capacity":3},
  {"species":"heron","name":"裂风鹭","tribe":"bird","cost":2,"attack":2,"health":3,"native":["split"],"art":"heron","capacity":3},
  {"species":"goat","name":"黑山羊","tribe":"beast","cost":1,"attack":0,"health":1,"native":["triple"],"art":"goat","capacity":3},
  {"species":"experiment","name":"实验生物","tribe":"special","cost":2,"attack":0,"health":1,"native":["undying"],"art":"experiment","capacity":3},
  {"species":"mouse","name":"田鼠","tribe":"beast","cost":0,"attack":1,"health":1,"native":[],"art":"mouse","capacity":3},
  {"species":"rabbit","name":"兔","tribe":"beast","cost":0,"attack":0,"health":1,"native":["breed"],"art":"rabbit","capacity":3},
  {"species":"coyote","name":"郊狼","tribe":"beast","cost":1,"attack":1,"health":2,"native":["hunt"],"art":"wolf","capacity":3},
  {"species":"greywolf","name":"灰狼","tribe":"beast","cost":2,"attack":3,"health":3,"native":["pack"],"art":"wolf","capacity":3},
  {"species":"hyena","name":"鬣狗","tribe":"beast","cost":2,"attack":2,"health":3,"native":["scavenge"],"art":"wolf","capacity":3},
  {"species":"boar","name":"野猪","tribe":"beast","cost":1,"attack":2,"health":1,"native":["hunt"],"art":"bear","capacity":3},
  {"species":"hedgehog","name":"刺猬","tribe":"beast","cost":1,"attack":1,"health":2,"native":["thorns"],"art":"mouse","capacity":3},
  {"species":"bat","name":"蝙蝠","tribe":"beast","cost":1,"attack":1,"health":1,"native":["flying"],"art":"moth","capacity":3},
  {"species":"fawn","name":"幼鹿","tribe":"beast","cost":0,"attack":0,"health":1,"native":["support"],"art":"deer","capacity":3},
  {"species":"chick","name":"雏鸟","tribe":"bird","cost":0,"attack":0,"health":1,"native":["growth"],"art":"bird","capacity":3},
  {"species":"sparrow","name":"麻雀","tribe":"bird","cost":0,"attack":1,"health":1,"native":[],"art":"bird","capacity":3},
  {"species":"crow","name":"乌鸦","tribe":"bird","cost":1,"attack":1,"health":1,"native":["flying"],"art":"bird","capacity":3},
  {"species":"vulture","name":"秃鹫","tribe":"bird","cost":1,"attack":0,"health":2,"native":["flying","scavenge"],"art":"heron","capacity":3},
  {"species":"hen","name":"母鸡","tribe":"bird","cost":1,"attack":0,"health":3,"native":["nest"],"art":"bird","capacity":3},
  {"species":"falcon","name":"猎鹰","tribe":"bird","cost":2,"attack":3,"health":2,"native":["flying","dive"],"art":"bird","capacity":3},
  {"species":"albatross","name":"信天翁","tribe":"bird","cost":1,"attack":1,"health":1,"native":["flying","migrate"],"art":"heron","capacity":3},
  {"species":"eagle","name":"金雕","tribe":"bird","cost":3,"attack":4,"health":5,"native":["flying","split"],"art":"bird","capacity":3},
  {"species":"pigeon","name":"鸽子","tribe":"bird","cost":1,"attack":1,"health":2,"native":["migrate"],"art":"bird","capacity":3},
  {"species":"quail","name":"鹌鹑","tribe":"bird","cost":0,"attack":0,"health":2,"native":[],"art":"bird","capacity":3},
  {"species":"ant","name":"蚂蚁","tribe":"insect","cost":0,"attack":1,"health":1,"native":[],"art":"ant","capacity":3},
  {"species":"firefly","name":"萤火虫","tribe":"insect","cost":0,"attack":0,"health":1,"native":["support"],"art":"beetle","capacity":3},
  {"species":"mayfly","name":"蜉蝣","tribe":"insect","cost":0,"attack":1,"health":1,"native":["flying","shortlived"],"art":"moth","capacity":3},
  {"species":"worker","name":"工蚁","tribe":"insect","cost":1,"attack":1,"health":2,"native":["porter"],"art":"ant","capacity":3},
  {"species":"caterpillar","name":"毛虫","tribe":"insect","cost":1,"attack":0,"health":3,"native":["metamorph"],"art":"caterpillar","capacity":3},
  {"species":"mantis","name":"螳螂","tribe":"insect","cost":2,"attack":2,"health":2,"native":["double"],"art":"ant","capacity":3},
  {"species":"queen","name":"蜂后","tribe":"insect","cost":3,"attack":2,"health":6,"native":["swarm"],"art":"bee","capacity":3},
  {"species":"cricket","name":"蟋蟀","tribe":"insect","cost":0,"attack":1,"health":1,"native":[],"art":"ant","capacity":3},
  {"species":"ladybug","name":"瓢虫","tribe":"insect","cost":1,"attack":1,"health":2,"native":["armor"],"art":"beetle","capacity":3},
  {"species":"cicada","name":"蝉","tribe":"insect","cost":1,"attack":0,"health":2,"native":["brood","flying"],"art":"moth","capacity":3},
  {"species":"gecko","name":"壁虎","tribe":"reptile","cost":0,"attack":1,"health":1,"native":[],"art":"lizard","capacity":3},
  {"species":"turtle","name":"小龟","tribe":"reptile","cost":0,"attack":0,"health":2,"native":[],"art":"turtle","capacity":3},
  {"species":"snake","name":"毒蛇","tribe":"reptile","cost":1,"attack":1,"health":1,"native":["poison"],"art":"snake","capacity":3},
  {"species":"lizard","name":"蜥蜴","tribe":"reptile","cost":1,"attack":1,"health":2,"native":["tail"],"art":"lizard","capacity":3},
  {"species":"tortoise","name":"陆龟","tribe":"reptile","cost":1,"attack":0,"health":3,"native":["armor"],"art":"turtle","capacity":3},
  {"species":"chameleon","name":"变色龙","tribe":"reptile","cost":2,"attack":2,"health":2,"native":["stealth"],"art":"lizard","capacity":3},
  {"species":"python","name":"巨蟒","tribe":"reptile","cost":2,"attack":2,"health":4,"native":["devour"],"art":"snake","capacity":3},
  {"species":"crocodile","name":"鳄鱼","tribe":"reptile","cost":3,"attack":5,"health":6,"native":["ambush"],"art":"lizard","capacity":3},
  {"species":"skink","name":"石龙子","tribe":"reptile","cost":1,"attack":2,"health":1,"native":["stealth"],"art":"lizard","capacity":3},
  {"species":"iguana","name":"鬣蜥","tribe":"reptile","cost":1,"attack":1,"health":3,"native":[],"art":"lizard","capacity":3},
  {"species":"spiderling","name":"幼蛛","tribe":"spider","cost":0,"attack":0,"health":1,"native":["web"],"art":"spider","capacity":3},
  {"species":"orbweaver","name":"园蛛","tribe":"spider","cost":1,"attack":1,"health":2,"native":["web"],"art":"spider","capacity":3},
  {"species":"venomspider","name":"毒蛛","tribe":"spider","cost":1,"attack":1,"health":1,"native":["web","poison"],"art":"spider","capacity":3},
  {"species":"wolfspider","name":"狼蛛","tribe":"spider","cost":2,"attack":3,"health":2,"native":["birdcatcher"],"art":"spider","capacity":3},
  {"species":"squirrel","name":"松鼠","tribe":"special","cost":0,"attack":0,"health":1,"native":[],"art":"squirrel","capacity":3},
  { species: 'viper', name: '蝰蛇', tribe: 'reptile', cost: 1, attack: 0, health: 1, native: [], art: 'snake', capacity: 3 },
]
export function makeCard(index: number, id: string): Card { const card = templates[index % templates.length]; return { ...card, native: [...card.native], added: [], id } }
export function creature(species: Species, id: string): Card { const index = templates.findIndex(c => c.species === species); if (index < 0) throw new Error('Unknown card: ' + species); return makeCard(index, id) }
export function makeSquirrel(id: string): Card { return creature('squirrel', id) }
export function allCreatures(): Card[] { return templates.map((_, index) => makeCard(index, 'catalog-' + index)) }
export const sigils = (card: Card): Sigil[] => [...new Set([...card.native, ...card.added])]
export const load = (card: Card): number => card.added.reduce((sum, s) => sum + SIGILS[s].weight, 0)
export type TokenKind = 'youngRabbit' | 'larva' | 'egg' | 'butterfly' | 'bee' | 'tailToken'
const tokenTemplates: Record<TokenKind, Omit<Card, 'id' | 'added'>> = {
  youngRabbit: {"species":"youngRabbit","name":"幼兔","tribe":"beast","art":"rabbit","attack":0,"health":1,"native":[],"cost":0,"capacity":3,"token":true},
  larva: {"species":"larva","name":"幼虫","tribe":"insect","art":"caterpillar","attack":0,"health":1,"native":[],"cost":0,"capacity":3,"token":true},
  egg: {"species":"egg","name":"蛋","tribe":"bird","art":"egg","attack":0,"health":1,"native":[],"cost":0,"capacity":3,"token":true},
  butterfly: {"species":"butterfly","name":"蝶","tribe":"insect","art":"moth","attack":3,"health":3,"native":["flying"],"cost":0,"capacity":3,"token":true},
  bee: {"species":"bee","name":"蜂","tribe":"insect","art":"bee","attack":1,"health":1,"native":["flying","shortlived"],"cost":0,"capacity":3,"token":true},
  tailToken: {"species":"tailToken","name":"尾巴","tribe":"reptile","art":"snake","attack":0,"health":1,"native":[],"cost":0,"capacity":3,"token":true},
}
export function makeToken(kind: TokenKind, id: string): Card { const card = tokenTemplates[kind]; return { ...card, id, added: [], native: [...card.native] } }

export function allTokens(): Card[] { return (Object.keys(tokenTemplates) as TokenKind[]).map(kind => makeToken(kind, 'catalog-token-' + kind)) }
