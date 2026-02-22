import os
import sys
import re
import json
import datetime
import urllib.parse
from groq import Groq
from tavily import TavilyClient

# --- قراءة مفاتيح API ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

# تحقق فوري من المفاتيح
if not GROQ_API_KEY or not TAVILY_API_KEY:
    print("❌ خطأ فادح: مفاتيح API غير موجودة!")
    print(f"GROQ_API_KEY: {'✓ موجود' if GROQ_API_KEY else '✗ مفقود'}")
    print(f"TAVILY_API_KEY: {'✓ موجود' if TAVILY_API_KEY else '✗ مفقود'}")
    sys.exit(1)

print("✅ مفاتيح API مؤكدة - جاري التهيئة...")

# --- تهيئة الأدوات ---
client = Groq(api_key=GROQ_API_KEY)
tavily = TavilyClient(api_key=TAVILY_API_KEY)

# --- مصادر البحث المتخصصة (جزائرية + اقتصادية) ---
SOURCES = [
    "الجزائر اقتصاد نمو GDP 2026",
    "البنك المركزي الجزائري احتياطي صرف",
    "البرلمان الجزائري قانون مالية",
    "الجزائر صادرات محروقات إحصائيات",
    "الجزائر بطالة استثمار أرقام رسمية",
    "APS الجزائر بيان رسمي"
]

def extract_numbers(text):
    """استخراج الأرقام والإحصائيات من النص"""
    if not text:
        return []
    # أنماط للأرقام: 10%, 5 مليار، 2.5 مليون، 2026، $300
    patterns = [
        r'\d+(?:[.,]\d+)?\s*(?:٪|%|percent)',
        r'\d+(?:[.,]\d+)?\s*(?:مليار|مليون|ألف)',
        r'\d{4}',  # سنوات
        r'\$\s*\d+(?:[.,]\d+)?[BMK]?',
        r'\d+(?:[.,]\d+)?\s*(?:دولار|دينار|يورو)'
    ]
    found = []
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        found.extend(matches)
    return list(set(found))  # إزالة التكرار

def search_news():
    """البحث عن أخبار جزائرية مع استخراج البيانات"""
    print("🔍 جاري البحث عن أخبار وبيانات جزائرية...")
    
    all_results = []
    for query in SOURCES:
        try:
            response = tavily.search(
                query=query, 
                search_depth="advanced", 
                max_results=3
            )
            for result in response.get('results', []):
                # استخراج الأرقام من كل نتيجة
                result['numbers'] = extract_numbers(result.get('content', ''))
                all_results.append(result)
        except Exception as e:
            print(f"⚠️ خطأ في '{query}': {e}")
            continue
    
    print(f"📊 تم العثور على {len(all_results)} نتائج")
    return all_results[:12]  # أفضل 12 نتيجة

def write_article(news_results, topic_num):
    """كتابة مقال تحليلي احترافي بأرقام وحقائق"""
    print(f"✍️ جاري كتابة المقال التحليلي #{topic_num+1}...")
    
    # مواضيع متخصصة مع تركيز على البيانات
    topics = [
        {
            "title": "الاقتصاد الجزائري: قراءة في الأرقام والمؤشرات",
            "focus": "تحليل اقتصادي كمي: نمو، تضخم، احتياطي صرف، ميزانية",
            "category": "اقتصاد"
        },
        {
            "title": "السياسة الخارجية: مواقف الجزائر في المحافل الدولية",
            "focus": "تحليل دبلوماسي: قرارات، تصويتات، علاقات ثنائية",
            "category": "سياسة"
        },
        {
            "title": "الإصلاحات الاجتماعية: وقائع وتأثير ملموس",
            "focus": "تحليل اجتماعي: برامج، إحصائيات، فوائد للمواطن",
            "category": "مجتمع"
        }
    ]
    
    topic = topics[topic_num % len(topics)]
    
    # جمع السياق مع التركيز على الأرقام
    context_parts = []
    all_numbers = []
    
    for r in news_results[:6]:
        title = r.get('title', '')
        content = r.get('content', '')
        numbers = r.get('numbers', [])
        
        if numbers:
            all_numbers.extend(numbers)
            context_parts.append(f"📊 {title}: {content[:150]} | أرقام: {', '.join(numbers[:3])}")
        else:
            context_parts.append(f"📰 {title}: {content[:150]}")
    
    context = "\n".join(context_parts)
    unique_numbers = list(set(all_numbers))[:8]  # أفضل 8 أرقام فريدة
    
    prompt = f"""
    أنت محلل سياسي واقتصادي جزائري محترف بخبرة 20 سنة في الكتابة التحليلية.

    🎯 المهمة: كتابة مقال تحليلي احترافي عن:
    - العنوان: {topic['title']}
    - المحور: {topic['focus']}
    - التصنيف: {topic['category']}

    📋 البيانات المتاحة:
    {context}

    📈 الأرقام المستخرجة للتركيز عليها:
    {', '.join(unique_numbers) if unique_numbers else 'ابحث عن أرقام في المصادر المذكورة'}

    ✍️ الهيكل الإلزامي للمقال (التزم به حرفياً):

    ## 1️⃣ المقدمة الرقمية (80-100 كلمة)
    - ابدأ برقم أو إحصائية صادمة/مهمة
    - مثال: "كشف تقرير البنك المركزي أن الاحتياطي بلغ X مليار دولار..."
    - حدد سياق المقال في جملة واحدة

    ## 2️⃣ 📊 لوحة الأرقام الرئيسية (150 كلمة)
    - قدّم 3-5 أرقام/إحصائيات في شكل نقاط أو جدول صغير
    - لكل رقم: المصدر + السنة + الدلالة
    - مثال:
      * النمو الاقتصادي: 3.2% (وزارة المالية، 2025)
      * معدل التضخم: 9.1% (البنك المركزي، ديسمبر 2025)

    ## 3️⃣ 📈 التحليل الاقتصادي العميق (300 كلمة)
    - حلّل الأسباب الجذرية وراء الأرقام
    - قارن مع: السنة الماضية، دول مغاربية (المغرب، تونس)، متوسط إفريقي
    - استخدم مصطلحات اقتصادية دقيقة: (ميزان مدفوعات، عجز موازناتي، سيولة نقدية...)
    - قدّم سيناريوهين: متفائل / متشائم للـ 12 شهر القادمة

    ## 4️⃣ ⚖️ النقد البناء والبدائل (200 كلمة)
    - انتقد السياسات والبرامج (ليس الأشخاص)
    - اذكر: ما نجح ✓ / ما فشل ✗ / ما يحتاج مراجعة ⚠️
    - استشهد بتجربة دولية ناجحة مشابهة (الإمارات، رواندا، ماليزيا...)

    ## 5️⃣ 💡 التوصيات العملية القابلة للتطبيق (100 كلمة)
    - 3 توصيات محددة ومرقمة
    - كل توصية: فعل + فاعل + نتيجة متوقعة
    - مثال: "1. إعادة هيكلة دعم المحروقات تدريجياً خلال 3 سنوات لتخفيف العبء عن الميزانية"

    🎨 قواعد الكتابة:
    - ✅ كل فقرة تحتوي على رقم أو إحصائية أو مصدر
    - ✅ استخدم **عناوين فرعية** بين النجوم: **📊 الأرقام**، **📈 التحليل**
    - ✅ اجعل اللغة عربية فصيحة ولكن واضحة (تجنب التعقيد)
    - ✅ لا فلسفة، لا عمومية، فقط وقائع وتحليل
    - ✅ إذا لم تجد رقماً دقيقاً، اكتب "حسب تقديرات..." أو "تشير البيانات الأولية..."

    📤 قدّم الإجابة كـ JSON صالح فقط (بدون أي نص إضافي):
    {{
      "title": "عنوان جذاب يحتوي على رقم إن أمكن",
      "excerpt": "ملخص في سطرين مع إبراز أهم رقم",
      "content": "المقال الكامل بتنسيق Markdown: **عريض** للعناوين الفرعية، *مائل* للأرقام المهمة",
      "category": "{topic['category']}",
      "keyFigures": ["رقم 1 مع مصدر", "رقم 2 مع مصدر", "رقم 3 مع مصدر"],
      "sources": ["رابط مصدر 1", "رابط مصدر 2"]
    }}
    """
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,  # أقل عشوائية = أكثر واقعية ودقة
        max_tokens=2000
    )
    
    content = response.choices[0].message.content
    # تنظيف المخرجات من علامات الكود
    content = content.replace('```json', '').replace('```', '').strip()
    
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        print("⚠️ تحذير: لم يعدل JSON صالح، استخدام fallback")
        return {
            "title": f"تحليل: {topic['title']}",
            "excerpt": content[:200] + "...",
            "content": content,
            "category": topic['category'],
            "keyFigures": unique_numbers[:3] if unique_numbers else [],
            "sources": [r.get('url') for r in news_results[:2] if r.get('url')]
        }

def generate_image(title, category):
    """إنشاء رابط صورة احترافية من Pollinations.ai"""
    # تشفير العنوان للرابط (منع المسافات والرموز الخاصة)
    safe_title = urllib.parse.quote(title[:45], safe='')
    
    # خرائط الفئات إلى prompts بصرية احترافية
    category_prompts = {
        "اقتصاد": "economy_charts_graphs_business_professional",
        "سياسة": "parliament_politics_flag_diplomacy_serious",
        "مجتمع": "society_people_culture_education_development"
    }
    
    base_prompt = category_prompts.get(category, "news_journalism_professional")
    
    # رابط Pollinations الصحيح (بدون مسافات زائدة!)
    return f"https://image.pollinations.ai/prompt/{base_prompt}_{safe_title}?width=1200&height=630&nologo=true&seed={datetime.datetime.now().second}"

def save_article(article_data, article_id):
    """حفظ المقال في ملف JSON مع التحقق من الجودة"""
    print("💾 جاري حفظ المقال...")
    
    os.makedirs('data', exist_ok=True)
    
    # تحميل المقالات الموجودة
    try:
        with open('data/articles.json', 'r', encoding='utf-8') as f:
            articles = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        articles = []
    
    # بناء كائن المقال الجديد
    new_article = {
        "id": article_id,
        "title": article_data.get("title", "تحليل يومي"),
        "excerpt": article_data.get("excerpt", ""),
        "content": article_data.get("content", ""),
        "category": article_data.get("category", "سياسة"),
        "author": "فريق التحليل الآلي",
        "date": datetime.datetime.now().strftime("%d %B %Y"),
        "imageUrl": generate_image(
            article_data.get("title", ""), 
            article_data.get("category", "")
        ),
        "isBreaking": article_id.startswith(datetime.date.today().strftime("%Y-%m-%d")),
        "readTime": f"{max(3, len(article_data.get('content', '').split()) // 200)} دقائق",
        "keyFigures": article_data.get("keyFigures", []),
        "sources": article_data.get("sources", [])
    }
    
    # تجنب التكرار حسب ID
    existing_ids = [a.get('id') for a in articles]
    if new_article['id'] not in existing_ids:
        articles.insert(0, new_article)
        print(f"✅ أُضيف مقال جديد: {new_article['title']}")
    else:
        print(f"⚠️ المقال موجود مسبقاً: {article_id}")
    
    # الاحتفاظ بآخر 25 مقال فقط (لتحسين الأداء)
    articles = articles[:25]
    
    # الحفظ مع ترميز UTF-8 للعربية
    with open('data/articles.json', 'w', encoding='utf-8') as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)
    
    print(f"📁 تم الحفظ في data/articles.json")
    return new_article

# --- التشغيل الرئيسي ---
if __name__ == "__main__":
    try:
        print("🚀 بدء إنشاء المقالات التحليلية الاحترافية...\n")
        print(f"📅 التاريخ: {datetime.date.today()}")
        print(f"🔑 Groq: {'✓' if GROQ_API_KEY else '✗'} | Tavily: {'✓' if TAVILY_API_KEY else '✗'}\n")
        
        # 1. جمع الأخبار والبيانات
        news = search_news()
        if not news:
            print("⚠️ تحذير: لم يتم العثور على أخبار، استخدام محتوى احتياطي")
        
        # 2. إنشاء 3 مقالات متخصصة
        print(f"\n📝 جاري إنشاء 3 مقالات تحليلية...\n")
        
        for i in range(3):
            article_id = f"{datetime.date.today()}-{i+1}"
            print(f"--- مقال {i+1}/3 ---")
            
            article = write_article(news, i)
            save_article(article, article_id)
            
            # عرض سريع للنتيجة
            print(f"✓ العنوان: {article.get('title', 'N/A')[:60]}...")
            print(f"✓ الأرقام الرئيسية: {len(article.get('keyFigures', []))} أرقام")
            print()
        
        # 3. ملخص التنفيذ
        print("=" * 50)
        print("🎉 اكتملت المهمة بنجاح!")
        print(f"📊 إجمالي المقالات في الملف: {len(json.load(open('data/articles.json', 'r', encoding='utf-8')))}")
        print(f"🔗 الموقع: https://political-life-blog.vercel.app")
        print("=" * 50)
        
    except KeyboardInterrupt:
        print("\n⚠️ تم إيقاف العملية يدوياً")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ خطأ غير متوقع: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
