import os
import sys
import re
import json
import datetime
import urllib.parse
from groq import Groq
from tavily import TavilyClient

# --- مفاتيح API ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

if not GROQ_API_KEY or not TAVILY_API_KEY:
    print("❌ مفاتيح API مفقودة!")
    sys.exit(1)

print("✅ المفاتيح مؤكدة")

client = Groq(api_key=GROQ_API_KEY)
tavily = TavilyClient(api_key=TAVILY_API_KEY)

SOURCES = [
    "الجزائر اقتصاد 2026",
    "البرلمان الجزائري",
    "الجزائر سياسة خارجية"
]

def extract_numbers(text):
    if not text:
        return []
    return list(set(re.findall(r'\d+(?:[.,]\d+)?\s*(?:٪|%|مليار|مليون)', text)))

def search_news():
    print("🔍 بحث...")
    all_results = []
    for query in SOURCES:
        try:
            response = tavily.search(query=query, search_depth="advanced", max_results=3)
            for result in response.get('results', []):
                result['numbers'] = extract_numbers(result.get('content', ''))
                all_results.append(result)
        except:
            continue
    return all_results[:10]

def write_article(news_results, topic_num):
    print(f"✍️ مقال {topic_num+1}...")
    
    topics = [
        {"title": "الاقتصاد الجزائري: أرقام وتحليل", "category": "اقتصاد"},
        {"title": "السياسة الخارجية للجزائر", "category": "دولي"},
        {"title": "الإصلاحات الاجتماعية", "category": "مجتمع"}
    ]
    
    topic = topics[topic_num % len(topics)]
    context = "\n".join([f"- {r['title']}: {r['content'][:150]}" for r in news_results[:5]])
    
    prompt = f"""
    أنت محلل جزائري محترف.
    الموضوع: {topic['title']}
    التصنيف: {topic['category']}
    الأخبار: {context}

    اكتب مقالاً بـ:
    1. مقدمة برقم مهم
    2. حقائق وأرقام (3-5 أرقام)
    3. تحليل اقتصادي/سياسي
    4. نقد بناء
    5. توصيات

    JSON فقط:
    {{
      "title": "عنوان",
      "excerpt": "ملخص سطرين",
      "content": "المقال الكامل",
      "category": "{topic['category']}"
    }}
    """
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4
    )
    
    content = response.choices[0].message.content.replace('```json', '').replace('```', '').strip()
    
    try:
        data = json.loads(content)
        # تأكد من category
        if not data.get('category'):
            data['category'] = topic['category']
        return data
    except:
        return {
            "title": topic['title'],
            "excerpt": content[:200],
            "content": content,
            "category": topic['category']  # مهم جداً!
        }

def generate_image(category):
    """صور مضمونة 100%"""
    images = {
        "اقتصاد": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=600",
        "دولي": "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=600",
        "مجتمع": "https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=800&h=600",
        "سياسة": "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&h=600",
        "وطني": "https://images.unsplash.com/photo-1569288063643-5d29ad6559c0?w=800&h=600"
    }
    return images.get(category, images["سياسة"])

def save_article(article_data, article_id):
    print("💾 حفظ...")
    os.makedirs('data', exist_ok=True)
    
    try:
        with open('data/articles.json', 'r', encoding='utf-8') as f:
            articles = json.load(f)
    except:
        articles = []
    
    category = article_data.get('category', 'سياسة')
    
    new_article = {
        "id": article_id,
        "title": article_data.get('title', 'مقال'),
        "excerpt": article_data.get('excerpt', ''),
        "content": article_data.get('content', ''),
        "category": category,  # مهم!
        "author": "المحرر الآلي",
        "date": datetime.datetime.now().strftime("%d %B %Y"),
        "imageUrl": generate_image(category),  # صورة مضمونة
        "isBreaking": True,
        "readTime": "5 دقائق"
    }
    
    existing_ids = [a.get('id') for a in articles]
    if new_article['id'] not in existing_ids:
        articles.insert(0, new_article)
    
    articles = articles[:20]
    
    with open('data/articles.json', 'w', encoding='utf-8') as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)
    
    print(f"✅ {new_article['title']} - {category}")
    return new_article

if __name__ == "__main__":
    try:
        print("🚀 بدء...\n")
        news = search_news()
        
        for i in range(3):
            article_id = f"{datetime.date.today()}-{i+1}"
            article = write_article(news, i)
            save_article(article, article_id)
        
        print("\n🎉 تم!")
        
    except Exception as e:
        print(f"❌ {e}")
        sys.exit(1)
