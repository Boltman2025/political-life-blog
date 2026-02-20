import os
import sys
import datetime
import json
from groq import Groq
from tavily import TavilyClient
import requests

# --- قراءة المفاتيح بطريقة أقوى ---
def get_env(key, default=""):
    """قراءة متغير بيئي مع طباعة للتصحيح"""
    value = os.getenv(key, default)
    if not value and default == "":
        print(f"⚠️ تحذير: {key} غير موجود في البيئة!")
    return value

GROQ_API_KEY = get_env("GROQ_API_KEY")
TAVILY_API_KEY = get_env("TAVILY_API_KEY")

# تحقق فوري من المفاتيح
if not GROQ_API_KEY or not TAVILY_API_KEY:
    print("❌ خطأ: مفاتيح API غير موجودة!")
    print(f"GROQ_API_KEY: {'✓' if GROQ_API_KEY else '✗'}")
    print(f"TAVILY_API_KEY: {'✓' if TAVILY_API_KEY else '✗'}")
    sys.exit(1)

print("✅ مفاتيح API موجودة، جاري التهيئة...")

# --- تهيئة الأدوات ---
client = Groq(api_key=GROQ_API_KEY)
tavily = TavilyClient(api_key=TAVILY_API_KEY)import os
import datetime
import json
from groq import Groq
from tavily import TavilyClient
import requests

# --- إعدادات المفاتيح ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

# --- تهيئة الأدوات ---
client = Groq(api_key=GROQ_API_KEY)
tavily = TavilyClient(api_key=TAVILY_API_KEY)

def search_news():
    """البحث عن أخبار الجزائر"""
    print("🔍 جاري البحث عن أخبار الجزائر السياسية والاقتصادية...")
    queries = [
        "أخبار الجزائر السياسية اليوم",
        "اقتصاد الجزائر 2026",
        "إصلاحات الجزائر"
    ]
    
    all_results = []
    for query in queries:
        try:
            response = tavily.search(query=query, search_depth="advanced", max_results=3)
            all_results.extend(response['results'])
        except:
            continue
    
    context = ""
    for result in all_results[:5]:
        context += f"- {result['title']}: {result['content']}\n"
    
    return context if context else "لا توجد أخبار جديدة - استخدم مواضيع عامة"

def write_article(news_context, topic_num):
    """كتابة مقال نقدي بناء"""
    print(f"✍️ جاري كتابة المقال رقم {topic_num}...")
    
    topics = [
        "السياسة الخارجية والعلاقات الدولية",
        "الاقتصاد والتنويع الاقتصادي",
        "الإصلاحات الاجتماعية والتعليم"
    ]
    
    topic = topics[topic_num % len(topics)]
    
    prompt = f"""
    أنت محرر سياسي جزائري محترف ومخضرم.
    الموضوع: {topic}
    الأخبار المتاحة:
    {news_context}

    اكتب مقالاً نقدياً بناءً مع الالتزام الصارم بـ:
    1.严禁 الهجوم على الأشخاص - انقد السياسات والبرامج فقط
    2. اللغة عربية فصيحة وسليمة
    3. الهيكل: 
       - مقدمة جذابة (100 كلمة)
       - تحليل الحدث (200 كلمة)
       - نقد بناء للسياسة (200 كلمة)
       - بديل عملي مقترح (150 كلمة)
    4. الطول الإجمالي: 600-700 كلمة
    5. استخدم عناوين فرعية مثل: **التحليل:** و **البديل المقترح:**
    
    قدّم الإجابة كـ JSON بهذا الشكل الدقيق:
    {{
      "title": "عنوان المقال الجذاب",
      "excerpt": "ملخص في سطرين كحد أقصى",
      "content": "المقال الكامل مع التنسيق",
      "category": "سياسة أو اقتصاد أو مجتمع"
    }}
    """

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7
    )
    
    content = response.choices[0].message.content
    content = content.replace('```json', '').replace('```', '').strip()
    
    try:
        article_data = json.loads(content)
        return article_data
    except:
        return {
            "title": f"تحليل: {topic}",
            "excerpt": content[:200],
            "content": content,
            "category": "سياسة"
        }

def generate_image_url(title, category):
    """إنشاء رابط صورة احترافية"""
    print("🎨 جاري إنشاء الصورة...")
    safe_title = title[:40].replace(" ", "_").replace(":", "").replace("?", "")
    
    category_prompts = {
        "سياسة": "political_flag_parliament",
        "اقتصاد": "economy_business_industry",
        "مجتمع": "society_people_culture"
    }
    
    prompt = category_prompts.get(category, "news")
    return f"https://image.pollinations.ai/prompt/{safe_title}_{prompt}_Algeria_professional_journalism?width=800&height=600&nologo=true&seed={datetime.datetime.now().second}"

def load_existing_articles():
    """تحميل المقالات الموجودة"""
    try:
        os.makedirs('data', exist_ok=True)
        with open('data/articles.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return []

def save_article(article_data, article_id):
    """حفظ المقال في JSON"""
    print("💾 جاري حفظ المقال...")
    
    articles = load_existing_articles()
    
    category = article_data.get("category", "سياسة")
    
    new_article = {
        "id": article_id,
        "title": article_data.get("title", "تحليل يومي"),
        "excerpt": article_data.get("excerpt", ""),
        "content": article_data.get("content", ""),
        "category": category,
        "author": "المحرر الآلي",
        "date": datetime.datetime.now().strftime("%d %B %Y"),
        "imageUrl": generate_image_url(article_data.get("title", ""), category),
        "isBreaking": article_id.startswith(datetime.date.today().strftime("%Y-%m-%d")),
        "readTime": f"{len(article_data.get('content', '').split()) // 200 + 1} دقائق"
    }
    
    # تجنب التكرار
    existing_ids = [a.get('id') for a in articles]
    if new_article['id'] not in existing_ids:
        articles.insert(0, new_article)
    
    # الاحتفاظ بآخر 20 مقال
    articles = articles[:20]
    
    with open('data/articles.json', 'w', encoding='utf-8') as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)
    
    print(f"✅ تم حفظ المقال: {new_article['title']}")
    return new_article

def generate_infographic_data(articles):
    """إنشاء بيانات للإنفوغرافيا"""
    print("📊 جاري إنشاء بيانات الإنفوغرافيا...")
    
    # إحصائيات بسيطة
    categories = {}
    for article in articles:
        cat = article.get('category', 'أخرى')
        categories[cat] = categories.get(cat, 0) + 1
    
    infographic = {
        "total_articles": len(articles),
        "by_category": categories,
        "latest_update": datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    }
    
    with open('data/infographic.json', 'w', encoding='utf-8') as f:
        json.dump(infographic, f, ensure_ascii=False, indent=2)

# --- التشغيل الرئيسي ---
if __name__ == "__main__":
    try:
        print("🚀 بدء إنشاء المقالات اليومية...")
        
        news = search_news()
        
        # إنشاء 3 مقالات متنوعة
        for i in range(3):
            article_id = f"{datetime.date.today()}-{i+1}"
            article = write_article(news, i)
            save_article(article, article_id)
        
        # تحديث الإنفوغرافيا
        articles = load_existing_articles()
        generate_infographic_data(articles)
        
        print("\n🎉 اكتملت المهمة! تم إنشاء 3 مقالات بنجاح!")
        print(f"📊 إجمالي المقالات: {len(articles)}")
        
    except Exception as e:
        print(f"❌ حدث خطأ: {e}")
        import traceback

        traceback.print_exc()
