import { Article } from "./types";

type Props = {
  article: Article & {
    aiTitle?: string;
    aiSummary?: string;
    aiBody?: string;
    aiBullets?: string[];
    aiTags?: string[];
  };
  relatedArticles: (Article & {
    aiTitle?: string;
    aiSummary?: string;
  })[];
  onArticleClick: (a: Article) => void;
};

function pickDefaultImage(section?: string) {
  switch (section) {
    case "وطني":
      return "/images/default-national.png";
    case "اقتصاد":
      return "/images/default-economy.png";
    case "دولي":
      return "/images/default-world.png";
    case "رأي":
      return "/images/default-opinion.png";
    default:
      return "/images/default-national.png";
  }
}

function cleanText(s?: string) {
  if (!s) return "";
  return String(s).replace(/\s+/g, " ").trim();
}

function splitToParagraphs(text: string) {
  const t = cleanText(text);
  if (!t) return [];
  // لو النص فيه فواصل أسطر، نحترمها، وإلا نقطع بشكل لطيف
  const raw = t.split(/\n{2,}/g).map((x) => x.trim()).filter(Boolean);
  if (raw.length > 1) return raw;

  // fallback: تقسيم تقريبي على الجمل الطويلة
  const sentences = t.split(/(?<=[\.\!\؟\!])\s+/).filter(Boolean);
  const paras: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).trim().length > 380) {
      paras.push(buf.trim());
      buf = s;
    } else {
      buf = (buf + " " + s).trim();
    }
  }
  if (buf.trim()) paras.push(buf.trim());
  return paras;
}

function tagChip(label: string) {
  return (
    <span
      key={label}
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border border-gray-200 bg-gray-50 text-gray-800"
    >
      {label}
    </span>
  );
}

export function ArticleView({ article, relatedArticles, onArticleClick }: Props) {
  const title = article.aiTitle || article.title;
  const summary = article.aiSummary || article.excerpt || "";
  const image =
    (article as any).imageUrl && String((article as any).imageUrl).trim() !== ""
      ? String((article as any).imageUrl)
      : pickDefaultImage((article as any).section);

  const section = (article as any).section || "";
  const date = (article as any).date || "";
  const sourceName = (article as any).sourceName || "";
  const sourceUrl = (article as any).sourceUrl || "";

  // محتوى موسّع إن وجد (aiBody)، وإلا نستخدم summary كمدخل لقراءة لطيفة
  const bodyText = cleanText((article as any).aiBody) || cleanText(summary);

  const paragraphs = splitToParagraphs(bodyText);

  // نقاط مركزة (إن لم تكن موجودة، نصنعها من summary بشكل بسيط)
  const bullets: string[] =
    Array.isArray((article as any).aiBullets) && (article as any).aiBullets.length
      ? (article as any).aiBullets.slice(0, 5)
      : (() => {
          const s = cleanText(summary);
          if (!s) return [];
          // محاولة استخراج 3 نقاط من النص
          const parts = s.split(/[\.!\؟]+/).map((x) => x.trim()).filter(Boolean);
          return parts.slice(0, 3);
        })();

  const tags: string[] =
    Array.isArray((article as any).aiTags) && (article as any).aiTags.length
      ? (article as any).aiTags.slice(0, 8)
      : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="relative">
          <img
            src={image}
            alt={title}
            className="w-full h-72 md:h-96 object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
          <div className="absolute inset-0 p-5 md:p-8 flex flex-col justify-end">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {section ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-red-600 text-white">
                  {section}
                </span>
              ) : null}
              {date ? (
                <span className="text-white/85 text-xs font-semibold">{date}</span>
              ) : null}
            </div>

            <h1 className="text-white text-2xl md:text-4xl font-extrabold leading-snug">
              {title}
            </h1>

            {summary ? (
              <p className="mt-3 text-white/90 leading-relaxed max-w-3xl">
                {summary}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-white text-gray-900 font-bold hover:bg-gray-100"
                >
                  المصدر
                </a>
              ) : null}
              <button
                className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold border border-white/20 hover:bg-white/15"
                onClick={() => window.scrollTo({ top: 9999, behavior: "smooth" })}
              >
                انتقل لأسفل
              </button>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="p-5 md:p-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-sm text-gray-600">
              {sourceName ? <span>المصدر: <b className="text-gray-900">{sourceName}</b></span> : null}
              {sourceName && date ? <span className="mx-2 text-gray-300">|</span> : null}
              {date ? <span>التاريخ: <b className="text-gray-900">{date}</b></span> : null}
            </div>

            {tags.length ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => tagChip(String(t)))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Think tank boxes */}
      {bullets.length ? (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="text-xs font-extrabold text-gray-700">الخلاصة</div>
            <ul className="mt-3 list-disc pr-5 text-gray-800 leading-relaxed space-y-2">
              {bullets.slice(0, 2).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="text-xs font-extrabold text-gray-700">لماذا يهم؟</div>
            <p className="mt-3 text-gray-800 leading-relaxed">
              هذا النوع من التطورات لا ينعكس فقط على الخبر العابر، بل على المزاج العام، كلفة المعيشة، وحدود القرار السياسي.
              المهم هو فهم “ما الذي يتغير تحت السطح” وليس فقط “ما الذي قيل اليوم”.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="text-xs font-extrabold text-gray-700">ماذا بعد؟</div>
            <p className="mt-3 text-gray-800 leading-relaxed">
              راقب المؤشرات التالية خلال الأيام المقبلة: اتجاه الخطاب الرسمي، تفاعل المؤسسات، وتحوّل الموضوع إلى قرارات قابلة للقياس.
              التحليل الحقيقي يبدأ عندما تظهر آثار التنفيذ.
            </p>
          </div>
        </section>
      ) : null}

      {/* Body */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 md:p-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-extrabold">التحليل</h2>
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-bold text-red-700 hover:text-red-800"
            >
              فتح المصدر
            </a>
          ) : null}
        </div>

        <div className="mt-5 space-y-4 text-gray-800 leading-[1.95] text-[17px]">
          {paragraphs.length ? (
            paragraphs.map((p, idx) => (
              <p key={idx} className="font-serif-ar">
                {p}
              </p>
            ))
          ) : (
            <p className="text-gray-700">لا يوجد نص متاح لهذا المقال بعد.</p>
          )}
        </div>

        {/* Quote box */}
        <div className="mt-7 p-5 rounded-2xl border border-gray-200 bg-gray-50">
          <div className="text-xs font-extrabold text-gray-700">ملاحظة تحريرية</div>
          <p className="mt-2 text-gray-800 leading-relaxed">
            نحن لا نعيد إنتاج الخبر، بل نضعه داخل سياقه السياسي والاقتصادي والاجتماعي.
            إذا كان الخبر صحيحًا، فالسؤال الأهم: لماذا الآن؟ ومن المستفيد؟ وما أثره لاحقًا؟
          </p>
        </div>
      </section>

      {/* Related */}
      {relatedArticles?.length ? (
        <section className="bg-white border border-gray-200 rounded-2xl p-5 md:p-8">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-extrabold">مقالات ذات صلة</h3>
            <span className="text-xs text-gray-500">مختارة من نفس الدفعة</span>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {relatedArticles.slice(0, 6).map((r: any) => (
              <button
                key={r.id || r.sourceUrl}
                onClick={() => onArticleClick(r)}
                className="text-right p-4 rounded-2xl border border-gray-200 hover:bg-gray-50 bg-white"
              >
                <div className="text-xs text-gray-500">
                  {(r.section || "عام") + (r.date ? ` • ${r.date}` : "")}
                </div>
                <div className="mt-2 font-extrabold leading-snug text-gray-900">
                  {r.aiTitle || r.title}
                </div>
                {r.aiSummary || r.excerpt ? (
                  <div className="mt-2 text-sm text-gray-700 leading-relaxed line-clamp-2">
                    {r.aiSummary || r.excerpt}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
