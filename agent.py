import os
import sys
import datetime
import json
from groq import Groq
from tavily import TavilyClient
import requests

# --- قراءة المفاتيح ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

# تحقق من المفاتيح
if not GROQ_API_KEY or not TAVILY_API_KEY:
    print("❌ خطأ: مفاتيح API غير موجودة!")
    print(f"GROQ_API_KEY: {'✓' if GROQ_API_KEY else '✗'}")
    print(f"TAVILY_API_KEY: {'✓' if TAVILY_API_KEY else '✗'}")
    sys.exit(1)

print("✅ مفاتيح API موجودة")

# --- تهيئة الأدوات ---
client = Groq(api_key=GROQ_API_KEY)
tavily = TavilyClient(api_key=TAVILY_API_KEY)

# --- مصادر البحث ---
SOURCES = [
    "الجزائر سياسة حكومة",
    "البرلمان الجزائري جلسة",
    "اقتصاد الجزائر 2026",
    "إصلاحات الجزائر"
]

def search_news():
    print("🔍 جاري البحث عن أخبار الجزائر...")
    all_results = []
    for query in SOURCES:
        try:
            response = tavily.search(query=query, search_depth="advanced", max_results=2)
            all_results.extend(response['results'])
        except Exception as e:
            print(f"⚠️ خطأ في '{query}': {e}")
    return all_results[:10]

def write_article(news_results, topic_num):
    print(f"✍️ جاري كتابة المقال {topic_num}...")
    
    topics = ["السياسة الخارجية", "الاقتصاد والتنويع", "الإصلاحات الاجتماعية"]
    topic = topics[topic_num % len(topics)]
    
    context = "\n".join([f"- {r['title']}: {r['content'][:200]}" for r in news_results])
    
    prompt = f"""
    أنت محرر سياسي جزائري محترف.
    الموضوع: {topic}
    الأخبار: {context}

    اكتب مقالاً تحليلياً:
    - مقدمة (100 كلمة)
    - تحليل (300 كلمة)
    - نقد بناء (200 كلمة)
    - بديل مقترح (150 كلمة)

    JSON فقط:
    {{
      "title": "...",
      "excerpt": "...",
      "content": "...",
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
        return json.loads(content)
    except:
        return {
            "title": f"تحليل: {topic}",
            "excerpt": content[:200],
            "content": content,
            "category": "سياسة"
        }

def generate_image(title, category):
    safe = title[:40].replace(" ", "_").replace(":", "")
    return f"https://image.pollinations.ai/prompt/{safe}_Algeria?width=800&height=600"

def save_article(article_data, article_id):
    os.makedirs('data', exist_ok=True)
    
    try:
        with open('data/articles.json', 'r', encoding='utf-8') as f:
            articles = json.load(f)
    except:
        articles = []
    
    new_article = {
        "id": article_id,
        "title": article_data.get("title", "مقال جديد"),
        "excerpt": article_data.get("excerpt", ""),
        "content": article_data.get("content", ""),
        "category": article_data.get("category", "سياسة"),
        "author": "المحرر الآلي",
        "date": datetime.datetime.now().strftime("%d %B %Y"),
        "imageUrl": generate_image(article_data.get("title", ""), article_data.get("category", "")),
        "isBreaking": True,
        "readTime": f"{len(article_data.get('content', '').split()) // 200 + 1} دقائق"
    }
    
    existing_ids = [a.get('id') for a in articles]
    if new_article['id'] not in existing_ids:
        articles.insert(0, new_article)
    
    articles = articles[:20]
    
    with open('data/articles.json', 'w', encoding='utf-8') as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)
    
    print(f"✅ حُفظ: {new_article['title']}")
    return new_article

# --- التشغيل الرئيسي ---
if __name__ == "__main__":
    try:
        print("🚀 بدء إنشاء المقالات...\n")
        
        news = search_news()
        print(f"📰 وُجد {len(news)} أخبار\n")
        
        for i in range(3):
            article_id = f"{datetime.date.today()}-{i+1}"
            article = write_article(news, i)
            save_article(article, article_id)
        
        print("\n🎉 اكتمل!")
        
    except Exception as e:
        print(f"❌ خطأ: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
