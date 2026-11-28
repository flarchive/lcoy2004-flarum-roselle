/*
 * tryhackx/flarum-thumb-sliders：缩略图滑块在主题行里的适配。
 *
 * 扩展自己会改写 DiscussionListItem.contentView，换成一套「缩略图 + 头像 +
 * 主栏 + 右侧元信息列」的 flex 布局。那套布局会丢掉主题的列（参与者、回复、
 * 浏览、活动），所以这里在扩展的 initializer 运行前，把它用于协调多个
 * TryHackX 扩展的全局标记登记为「布局已安装」，让
 * installDiscussionListLayout() 直接返回——缩略图本身仍由扩展注入
 * contentItems.thumbSlider，位置和样式由主题负责
 * （less/forum/thirdparty/ThumbSlider.less）。
 *
 * 赋值必须发生在模块求值时：initializer 要等 app.boot() 才执行，而所有
 * 扩展模块在那之前都已经加载完。`version` 是扩展在 2.2.0 里的布局版本，
 * 只用于避免它打出「版本漂移」的警告。
 */
const extensions = (window as any).flarum?.extensions;

// 没有扩展列表（意外的加载方式）时也照样标记：
// 最坏的情况是该扩展不再应用自己的网格。
if (!extensions || 'tryhackx-thumb-sliders' in extensions) {
  const global = window as any;

  global.tryhackxDLL = { ...(global.tryhackxDLL || {}), installed: true, version: 5 };
}
