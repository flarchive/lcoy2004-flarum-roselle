/*
 * 本主题的语言选择器：页头中，显示当前语言的旗帜和
 * 短代码（“PT ⌄”）的胶囊按钮；展开后，是一个带箭头的气泡，
 * 每行包含圆形旗帜、语言名称和语言代码（当前项
 * 带强调色圆环）。
 *
 * 旗帜（flag-icons，MIT，1×1 裁剪）位于 assets/flags，
 * 由 `php flarum assets:publish` 发布到
 * /assets/extensions/lcoy-roselle/flags。
 */
import app from 'flarum/forum/app';
import Dropdown from 'flarum/common/components/Dropdown';
import type Mithril from 'mithril';

import { t } from '../utils/settings';

/** 在 assets/flags 中有旗帜的国家代码（增删文件后，请重新生成此列表）。 */
const FLAGS = new Set(
  'ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw by bz ca cc cd cf cg ch ci ck cl cm cn co cp cr cu cv cw cx cy cz de dg dj dk dm do dz ec ee eg eh er es et eu fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu ic id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pc pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sr ss st sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug um un us uy uz va vc ve vg vi vn vu wf ws xk ye yt za zm zw'.split(
    ' '
  )
);

/** 仅有语言代码时的默认国家（带地区时以地区为准：`pt-BR` → br）。 */
const COUNTRY: Record<string, string> = {
  en: 'us',
  pt: 'pt',
  es: 'es',
  fr: 'fr',
  de: 'de',
  it: 'it',
  nl: 'nl',
  ja: 'jp',
  zh: 'cn',
  ru: 'ru',
  tr: 'tr',
  pl: 'pl',
  uk: 'ua',
  ko: 'kr',
  ar: 'sa',
  vi: 'vn',
  id: 'id',
  sv: 'se',
  da: 'dk',
  nb: 'no',
  no: 'no',
  fi: 'fi',
  cs: 'cz',
  el: 'gr',
  he: 'il',
  hu: 'hu',
  ro: 'ro',
  bg: 'bg',
  th: 'th',
  hi: 'in',
  bn: 'bd',
  fa: 'ir',
  ms: 'my',
  sk: 'sk',
  sl: 'si',
  hr: 'hr',
  sr: 'rs',
  lt: 'lt',
  lv: 'lv',
  et: 'ee',
  ca: 'es',
  is: 'is',
  ga: 'ie',
  sq: 'al',
  mk: 'mk',
  ka: 'ge',
  hy: 'am',
  az: 'az',
  kk: 'kz',
  uz: 'uz',
  mn: 'mn',
  ne: 'np',
  si: 'lk',
  km: 'kh',
  lo: 'la',
  my: 'mm',
  sw: 'ke',
  af: 'za',
  am: 'et',
  ur: 'pk',
  tl: 'ph',
};

/** 某个 locale 对应旗帜的国家（`pt-BR` → br，`en` → us），没有打包旗帜时为 `null`。 */
function countryOf(locale: string): string | null {
  const [language, ...rest] = locale.toLowerCase().split(/[-_]/);
  const country = rest.find((part) => /^[a-z]{2}$/.test(part)) ?? COUNTRY[language];

  return country && FLAGS.has(country) ? country : null;
}

/** 尺寸固定的旗帜（加载时不会跳动）；没有旗帜时，显示两个字母的徽标。 */
export function flag(locale: string, size: number): Mithril.Children {
  const country = countryOf(locale);

  return country ? (
    <img
      className="LcoyFlag"
      src={`${app.forum.attribute('assetsBaseUrl')}/extensions/lcoy-roselle/flags/${country}.svg`}
      width={size}
      height={size}
      alt=""
      decoding="sync"
    />
  ) : (
    <span className="LcoyFlag LcoyFlag--code" style={{ width: `${size}px`, height: `${size}px` }} aria-hidden="true">
      {locale.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** 旗帜旁的完整代码："pt-BR" → "PT-BR"，"en" → "EN"。 */
function shortCode(locale: string): string {
  return locale.replace('_', '-').toUpperCase();
}

/** 与核心相同的切换方式：已登录用户保存偏好；访客写入 cookie；页面重新加载。 */
function choose(locale: string): void {
  if (locale === (app.data as any).locale) return;

  if (app.session.user) {
    app.session.user.savePreferences({ locale }).then(() => window.location.reload());
  } else {
    document.cookie = `locale=${locale}; path=/; expires=Tue, 19 Jan 2038 03:14:07 GMT`;
    window.location.reload();
  }
}

/** 方向键在旗帜间移动（循环）；回车和空格选择，与所有按钮一致。 */
function move(event: KeyboardEvent): void {
  const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[event.key];

  if (!step) return;

  const menu = (event.currentTarget as HTMLElement).closest('.LcoyLocale-menu');
  const options = menu ? Array.from(menu.querySelectorAll<HTMLElement>('.LcoyLocale-option')) : [];

  event.preventDefault();
  event.stopPropagation();
  options[(options.indexOf(event.currentTarget as HTMLElement) + step + options.length) % options.length]?.focus();
}

export default function LocaleFlags(): Mithril.Children {
  const locales = ((app.data as any).locales || {}) as Record<string, string>;
  const current = ((app.data as any).locale || 'en') as string;

  return (
    <Dropdown
      className="LcoyLocale"
      buttonClassName="Button LcoyLocale-toggle"
      menuClassName="Dropdown-menu--right LcoyLocale-menu"
      caretIcon="fas fa-angle-down"
      label={[flag(current, 18), <span className="LcoyLocale-code">{shortCode(current)}</span>]}
      accessibleToggleLabel={t('header.language', { name: locales[current] ?? current })}
    >
      {Object.entries(locales).map(([locale, name]) => (
        <button
          type="button"
          className={`LcoyLocale-option${locale === current ? ' LcoyLocale-option--current' : ''}`}
          role="menuitemradio"
          aria-checked={String(locale === current)}
          lang={locale}
          onclick={() => choose(locale)}
          onkeydown={move}
        >
          {flag(locale, 24)}
          <span className="LcoyLocale-name">{name}</span>
          <span className="LcoyLocale-optionCode">{locale}</span>
        </button>
      ))}
    </Dropdown>
  );
}
