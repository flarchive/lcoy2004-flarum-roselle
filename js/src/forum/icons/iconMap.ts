/*
 * 主题的 Font Awesome → Lucide 映射。
 *
 * meta.discourse.org 不使用 Font Awesome 的实心图标：它运行官方
 * 主题组件 “Discourse Lucide Icons”
 * （github.com/discourse/discourse-lucide-icons），通过
 * `api.replaceIcon` 把 Discourse 的每个图标替换为 Lucide 的描边
 * 等价项。下面的 META_MAP 是该组件的表格，原样复制：它
 * 决定 Meta 用 Lucide 绘制哪些图标，哪些继续使用 Font
 * Awesome。只排除了 Discourse 的内部名称（`d-*`、
 * `discourse-*`、`notification.*`……），它们在 Flarum 中不存在。
 *
 * Discourse 的名称使用 Font Awesome 6（`magnifying-glass`，而不是
 * `search`；常规体使用 `far-bell`）。Flarum 和扩展仍在使用
 * 许多 FA 4/5 的别名，因此名称会先经过 FA_ALIASES。
 *
 * 本文件只有名称（字符串）：图案位于 glyphs.ts。
 */

/**
 * Font Awesome 的旧别名 → FA 6 的规范名称（Discourse 使用的
 * 名称）。只包含出现在核心、已安装扩展或主题中的，
 * 以及管理员为标签和用户组输入的最常见名称。
 */
export const FA_ALIASES: Record<string, string> = {
  'angle-double-down': 'angles-down',
  'angle-double-left': 'angles-left',
  'angle-double-right': 'angles-right',
  'angle-double-up': 'angles-up',
  'arrows-h': 'left-right',
  'arrows-v': 'up-down',
  'bar-chart': 'chart-bar',
  'calendar-alt': 'calendar-days',
  'check-circle': 'circle-check',
  'check-square': 'square-check',
  close: 'xmark',
  'cloud-download-alt': 'cloud-arrow-down',
  'cloud-upload-alt': 'cloud-arrow-up',
  cog: 'gear',
  'comment-alt': 'message',
  edit: 'pen-to-square',
  'ellipsis-h': 'ellipsis',
  'ellipsis-v': 'ellipsis-vertical',
  'envelope-open-text': 'envelope-open',
  'exclamation-circle': 'circle-exclamation',
  'exclamation-triangle': 'triangle-exclamation',
  'external-link': 'up-right-from-square',
  'external-link-alt': 'up-right-from-square',
  'file-alt': 'file-lines',
  'file-archive': 'file-zipper',
  'file-download': 'file-arrow-down',
  'file-upload': 'file-arrow-up',
  'globe-americas': 'earth-americas',
  history: 'clock-rotate-left',
  home: 'house',
  'info-circle': 'circle-info',
  'map-marker-alt': 'location-dot',
  'minus-circle': 'circle-minus',
  'mobile-alt': 'mobile-screen-button',
  'paint-brush': 'paintbrush',
  'pencil-alt': 'pencil',
  'photo-video': 'photo-film',
  'plus-circle': 'circle-plus',
  'plus-square': 'square-plus',
  poll: 'square-poll-vertical',
  'poll-h': 'square-poll-horizontal',
  'question-circle': 'circle-question',
  redo: 'arrow-rotate-right',
  refresh: 'arrows-rotate',
  remove: 'xmark',
  save: 'floppy-disk',
  search: 'magnifying-glass',
  'search-minus': 'magnifying-glass-minus',
  'search-plus': 'magnifying-glass-plus',
  'share-alt': 'share-nodes',
  'shield-alt': 'shield-halved',
  'sign-in-alt': 'right-to-bracket',
  'sign-out-alt': 'right-from-bracket',
  'sliders-h': 'sliders',
  smile: 'face-smile',
  'step-backward': 'backward-step',
  'step-forward': 'forward-step',
  stream: 'bars-staggered',
  sync: 'arrows-rotate',
  'sync-alt': 'rotate',
  'th-large': 'table-cells-large',
  'thumb-tack': 'thumbtack',
  times: 'xmark',
  'times-circle': 'circle-xmark',
  tired: 'face-tired',
  'trash-alt': 'trash-can',
  undo: 'arrow-rotate-left',
  'undo-alt': 'rotate-left',
  'unlock-alt': 'unlock-keyhole',
  'user-cog': 'user-gear',
  'user-edit': 'user-pen',
  'user-friends': 'user-group',
  'user-times': 'user-xmark',
  'vote-yea': 'check-to-slot',
  'volume-mute': 'volume-xmark',
  'volume-up': 'volume-high',
};

/**
 * “Discourse Lucide Icons” 的表格（Discourse 名称 → Lucide 名称），
 * 按原始顺序。`far-*` 这些键是常规体变体。
 */
export const META_MAP: Record<string, string> = {
  'align-left': 'align-left',
  anchor: 'anchor',
  asterisk: 'asterisk',
  award: 'award',
  ban: 'ban',
  bed: 'bed',
  bell: 'bell',
  bold: 'bold',
  book: 'book',
  bookmark: 'bookmark',
  briefcase: 'briefcase',
  calendar: 'calendar',
  'chart-bar': 'chart-bar',
  'chart-column': 'chart-column',
  'chart-line': 'chart-line',
  'chart-pie': 'chart-pie',
  check: 'check',
  circle: 'circle',
  'circle-check': 'circle-check',
  'circle-chevron-down': 'circle-chevron-down',
  'circle-minus': 'circle-minus',
  'circle-plus': 'circle-plus',
  'circle-stop': 'circle-stop',
  'circle-user': 'circle-user',
  clipboard: 'clipboard',
  clock: 'clock',
  code: 'code',
  copy: 'copy',
  crown: 'crown',
  download: 'download',
  eye: 'eye',
  file: 'file',
  'file-image': 'file-image',
  'file-video': 'file-video',
  flag: 'flag',
  folder: 'folder',
  'folder-open': 'folder-open',
  fire: 'flame',
  gift: 'gift',
  globe: 'globe',
  'graduation-cap': 'graduation-cap',
  hand: 'hand',
  headset: 'headset',
  heart: 'heart',
  house: 'house',
  'id-card': 'id-card',
  image: 'image',
  images: 'images',
  inbox: 'inbox',
  italic: 'italic',
  key: 'key',
  keyboard: 'keyboard',
  lightbulb: 'lightbulb',
  link: 'link',
  list: 'list',
  'list-check': 'list-check',
  lock: 'lock',
  medal: 'medal',
  minus: 'minus',
  moon: 'moon',
  paintbrush: 'paintbrush',
  palette: 'palette',
  pause: 'pause',
  pen: 'pen',
  pencil: 'pencil',
  play: 'play',
  plug: 'plug',
  plus: 'plus',
  'power-off': 'power-off',
  reply: 'reply',
  rocket: 'rocket',
  rss: 'rss',
  scroll: 'scroll',
  share: 'share',
  shuffle: 'shuffle',
  signal: 'signal',
  'spell-check': 'spell-check',
  'square-check': 'square-check',
  'square-plus': 'square-plus',
  stamp: 'stamp',
  star: 'star',
  sun: 'sun',
  table: 'table',
  tag: 'tag',
  tags: 'tags',
  trophy: 'trophy',
  upload: 'upload',
  user: 'user',
  users: 'users',
  'user-check': 'user-check',
  'user-pen': 'user-pen',
  'user-plus': 'user-plus',
  wrench: 'wrench',
  'angle-down': 'chevron-down',
  'angle-left': 'chevron-left',
  'angle-right': 'chevron-right',
  'angle-up': 'chevron-up',
  'angles-down': 'chevrons-down',
  'angles-left': 'chevrons-left',
  'angles-right': 'chevrons-right',
  'angles-up': 'chevrons-up',
  'arrow-down': 'arrow-down',
  'arrow-left': 'arrow-left',
  'arrow-line-left': 'arrow-left-from-line',
  'arrow-line-right': 'arrow-right-from-line',
  'arrow-right': 'arrow-right',
  'arrow-rotate-left': 'rotate-ccw',
  'arrow-rotate-right': 'rotate-cw',
  'arrow-up': 'arrow-up',
  'arrows-rotate': 'refresh-ccw',
  'caret-down': 'chevron-down',
  'caret-left': 'chevron-left',
  'caret-right': 'chevron-right',
  'caret-up': 'chevron-up',
  'chevron-down': 'chevron-down',
  'chevron-left': 'chevron-left',
  'chevron-right': 'chevron-right',
  'chevron-up': 'chevron-up',
  'address-book': 'book-user',
  'address-card': 'id-card',
  at: 'at-sign',
  backward: 'rewind',
  'backward-fast': 'skip-back',
  'backward-step': 'step-back',
  bars: 'menu',
  'bars-staggered': 'menu',
  'bell-slash': 'bell-off',
  'book-open-reader': 'book-open-text',
  'bookmark-delete': 'bookmark-x',
  'box-archive': 'archive',
  bullhorn: 'megaphone',
  bullseye: 'target',
  'cake-candles': 'cake',
  'calendar-day': 'calendar-days',
  category: 'lock',
  certificate: 'award',
  'check-to-slot': 'vote',
  'circle-exclamation': 'circle-alert',
  'circle-info': 'info',
  'circle-question': 'circle-help',
  'circle-xmark': 'circle-x',
  'clock-rotate-left': 'rotate-ccw',
  'cloud-arrow-down': 'cloud-download',
  'cloud-arrow-up': 'cloud-upload',
  comment: 'message-circle',
  'comment-dots': 'message-circle-more',
  'comment-slash': 'message-circle-off',
  comments: 'messages-square',
  compress: 'minimize',
  crosshairs: 'crosshair',
  cube: 'cuboid',
  cubes: 'boxes',
  desktop: 'monitor',
  'diagram-project': 'workflow',
  'earth-americas': 'globe',
  ellipsis: 'ellipsis',
  'ellipsis-vertical': 'ellipsis-vertical',
  envelope: 'mail',
  'eye-dropper': 'pipette',
  'eye-low-vision': 'eye-off',
  'eye-slash': 'eye-off',
  'face-angry': 'angry',
  'face-meh': 'meh',
  'face-smile': 'smile',
  'file-arrow-up': 'file-up',
  'file-audio': 'file-volume',
  'file-lines': 'file-text',
  'file-signature': 'file-pen',
  filter: 'funnel',
  'filter-circle-xmark': 'funnel-x',
  flask: 'flask-conical',
  'floppy-disk': 'save',
  font: 'type',
  forward: 'play',
  'forward-fast': 'fast-forward',
  'forward-step': 'skip-forward',
  gavel: 'gavel',
  gear: 'settings',
  'grip-lines': 'grip-horizontal',
  handshake: 'handshake',
  'handshake-angle': 'handshake',
  hashtag: 'hash',
  'hourglass-start': 'hourglass',
  language: 'languages',
  'layer-group': 'layers',
  'left-right': 'arrow-left-right',
  like: 'heart',
  'link-slash': 'link-2-off',
  'list-ol': 'list-ordered',
  'list-ul': 'list',
  'location-dot': 'map-pin',
  'location-pin': 'map-pin',
  'magnifying-glass': 'search',
  'magnifying-glass-minus': 'zoom-out',
  'magnifying-glass-plus': 'zoom-in',
  'microphone-slash': 'mic-off',
  'mobile-screen-button': 'smartphone',
  'paper-plane': 'send',
  'pen-to-square': 'square-pen',
  'puzzle-piece': 'puzzle',
  'quote-left': 'quote',
  'quote-right': 'quote',
  repeat: 'repeat',
  'right-from-bracket': 'log-out',
  'right-left': 'arrow-left-right',
  'right-to-bracket': 'log-in',
  robot: 'bot',
  rotate: 'rotate-ccw',
  'share-nodes': 'share-2',
  'shield-halved': 'shield-half',
  sliders: 'sliders-horizontal',
  sort: 'arrow-up-down',
  spinner: 'loader',
  'square-full': 'square',
  'table-cells': 'grid-3x3',
  'table-columns': 'columns-2',
  'temperature-three-quarters': 'thermometer',
  thumbtack: 'pin',
  'toggle-off': 'toggle-left',
  'toggle-on': 'toggle-right',
  'trash-can': 'trash',
  'triangle-exclamation': 'triangle-alert',
  'truck-medical': 'ambulance',
  unlock: 'lock-open',
  'unlock-keyhole': 'lock-keyhole-open',
  'up-down': 'arrow-up-down',
  'up-right-from-square': 'external-link',
  'user-gear': 'user-cog',
  'user-group': 'users',
  'user-secret': 'hat-glasses',
  'user-shield': 'shield-user',
  'user-xmark': 'user-x',
  'volume-high': 'volume-2',
  'volume-xmark': 'volume-x',
  'wand-magic': 'wand-sparkles',
  'wand-magic-sparkles': 'wand-sparkles',
  xmark: 'x',
  'far-bell': 'bell',
  'far-bell-slash': 'bell-off',
  'far-bookmark': 'bookmark',
  'far-calendar-plus': 'calendar-plus',
  'far-chart-bar': 'chart-bar',
  'far-circle': 'circle',
  'far-circle-dot': 'circle-dot',
  'far-circle-question': 'circle-question-mark',
  'far-clipboard': 'clipboard',
  'far-clock': 'clock',
  'far-comment': 'message-square',
  'far-comments': 'messages-square',
  'far-copy': 'copy',
  'far-copyright': 'copyright',
  'far-credit-card': 'credit-card',
  'far-envelope': 'mail',
  'far-eye': 'eye',
  'far-eye-slash': 'eye-off',
  'far-face-frown': 'frown',
  'far-face-meh': 'meh',
  'far-face-smile': 'smile',
  'far-file-lines': 'file-text',
  'far-heart': 'heart',
  'far-image': 'image',
  'far-moon': 'moon',
  'far-pen-to-square': 'square-pen',
  'far-square': 'square',
  'far-square-check': 'square-check',
  'far-star': 'star',
  'far-sun': 'sun',
  'far-thumbs-down': 'thumbs-down',
  'far-thumbs-up': 'thumbs-up',
  'far-trash-can': 'trash',
};

/**
 * Meta 组件默认忽略的图标（配置
 * `ignored_icons`: "d-liked|square-full|circle"）。实心 `circle` 保留在
 * Font Awesome 中，因为它被用作实心圆点（状态、未读）。`d-liked`
 * （点赞者的实心爱心）在 Flarum 中没有名称：主题通过 CSS
 * 填充 Lucide 的爱心来重现它（Icons.less）。
 */
export const META_IGNORED = new Set(['circle', 'square-full']);

/**
 * Flarum 和扩展使用、而 Discourse 没有的界面图标
 * （因此 Meta 无需映射）。没有它们，外壳会在同一栏中混合描边
 * 和实心；所选等价项来自 Lucide 本身。
 */
export const LCOY_EXTRAS: Record<string, string> = {
  // 编辑器（composer 与 markdown/bbcode 的格式工具栏）
  heading: 'heading',
  strikethrough: 'strikethrough',
  eraser: 'eraser',
  terminal: 'square-terminal',
  // 帖子和主题的操作
  'reply-all': 'reply-all',
  trash: 'trash',
  'lock-open': 'lock-open',
  'arrow-up-from-bracket': 'share',
  'arrows-left-right': 'arrow-left-right',
  'rotate-left': 'rotate-ccw',
  'code-branch': 'git-branch',
  print: 'printer',
  // Discourse 的 composer 使用 "discourse-expand/compress" → maximize/minimize
  expand: 'maximize',
  'up-right-and-down-left-from-center': 'maximize',
  'down-left-and-up-right-to-center': 'minimize',
  // 用户与审核
  'user-minus': 'user-minus',
  'user-slash': 'user-x',
  shield: 'shield',
  'grip-vertical': 'grip-vertical',
  // 私信、文件与投票（flarum/messages、fof/upload、fof/polls）
  message: 'message-square',
  'envelope-open': 'mail-open',
  'book-open': 'book-open',
  'file-code': 'file-code',
  'file-zipper': 'file-archive',
  'file-csv': 'file-spreadsheet',
  'file-excel': 'file-spreadsheet',
  'file-pdf': 'file-text',
  'file-word': 'file-text',
  'file-powerpoint': 'file-text',
  'file-contract': 'file-text',
  'file-export': 'file-output',
  'photo-film': 'images',
  'square-poll-horizontal': 'chart-bar',
  'square-poll-vertical': 'chart-column',
  'table-cells-large': 'grid-2x2',
  'pen-ruler': 'pencil-ruler',
  feather: 'feather',
  'calendar-days': 'calendar-days',
  'circle-dot': 'circle-dot',
  // 核心的主题选择器使用笔记本电脑表示“自动”
  laptop: 'laptop',
  // 管理员常给 Flarum 标签使用的图标：没有描边时，
  // 侧栏的“标签”区域会混合实心和描边。
  server: 'server',
  'universal-access': 'accessibility',
  // 手机上列表的“最新 ⌃⌄”选择器（`discourse-chevron-expand`，
  // Meta 组件会将其替换为 chevrons-up-down）。
  'discourse-chevron-expand': 'chevrons-up-down',
};

/** 属于样式而非图标名称的 Font Awesome 类。 */
const STYLE_CLASSES = new Set([
  'fa',
  'fas',
  'far',
  'fab',
  'fal',
  'fat',
  'fad',
  'fa-solid',
  'fa-regular',
  'fa-brands',
  'fa-light',
  'fa-thin',
  'fa-duotone',
  'fa-sharp',
  'fa-sharp-duotone',
]);

/** Font Awesome 的工具类（`fa-fw`、`fa-spin`、`fa-2x`……），它们也以 `fa-` 开头。 */
const UTILITY =
  /^fa-(fw|spin|spin-pulse|spin-reverse|pulse|beat|beat-fade|fade|bounce|shake|flip|border|inverse|li|ul|stack|stack-1x|stack-2x|lg|sm|xs|2xs|xl|2xl|\dx|10x|rotate-\d+|rotate-by|flip-\w+|pull-\w+|swap-opacity|width-auto)$/;

/**
 * Flarum 图标类（`fas fa-search`、`far fa-bell fa-fw`……）对应的
 * Lucide 名称，或当图标应继续使用 Font Awesome 时为 `null`：
 * 品牌（`fab`）、Meta 忽略的图标，以及所有不在映射中的
 * 图标，比如管理员为标签和用户组选择的大部分图标。
 */
export function lucideNameFor(classes: string): string | null {
  let regular = false;
  let brand = false;
  let icon: string | null = null;

  for (const cls of classes.split(/\s+/)) {
    if (!cls) continue;
    if (cls === 'far' || cls === 'fa-regular') regular = true;
    else if (cls === 'fab' || cls === 'fa-brands') brand = true;
    else if (icon === null && !STYLE_CLASSES.has(cls) && cls.startsWith('fa-') && !UTILITY.test(cls)) icon = cls.slice(3);
  }

  if (!icon || brand) return null;

  const name = FA_ALIASES[icon] ?? icon;

  // 在 Discourse 中常规体有自己的键（`far-bell`）。在 Flarum 中，
  // 同名的常规体和实心体是同一个界面图标，而在
  // Lucide（只有描边）中两者会相同：因此回退到实心体。
  const regularName = regular ? META_MAP[`far-${name}`] : undefined;
  if (regularName) return regularName;
  if (!regular && META_IGNORED.has(name)) return null;

  return META_MAP[name] ?? LCOY_EXTRAS[name] ?? null;
}
