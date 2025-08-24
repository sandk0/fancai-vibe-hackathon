#!/usr/bin/env python3
"""
Прямой тест API генерации изображений через HTTP запросы
"""

import asyncio
import aiohttp
import json
import sys

async def test_api_generation():
    """Тестирует API генерации изображений"""
    
    # Авторизация
    print("🔐 Авторизация...")
    login_data = {
        "email": "test@example.com", 
        "password": "testpassword123"
    }
    
    async with aiohttp.ClientSession() as session:
        try:
            # Логин
            async with session.post(
                "http://backend:8000/api/v1/auth/login",
                json=login_data
            ) as login_resp:
                if login_resp.status != 200:
                    text = await login_resp.text()
                    print(f"❌ Login failed: {login_resp.status}")
                    print(text)
                    return False
                
                login_result = await login_resp.json()
                access_token = login_result["tokens"]["access_token"]
                print(f"✅ Login successful")
                
            # Получаем описания
            headers = {"Authorization": f"Bearer {access_token}"}
            async with session.get(
                "http://backend:8000/api/v1/books/fadf0c65-f4ab-44fe-8a74-e61264233c76/chapters/1",
                headers=headers
            ) as desc_resp:
                if desc_resp.status != 200:
                    text = await desc_resp.text()
                    print(f"❌ Failed to get descriptions: {desc_resp.status}")
                    print(text)
                    return False
                    
                chapter_data = await desc_resp.json()
                descriptions = chapter_data.get("descriptions", [])
                
            if not descriptions:
                print("❌ No descriptions found")
                return False
                
            print(f"📋 Found {len(descriptions)} descriptions")
            
            # Ищем описание без изображения
            description_to_test = None
            for desc in descriptions:
                if not desc.get("generated_image"):
                    description_to_test = desc
                    break
                    
            if not description_to_test:
                print("⚠️  All descriptions already have images, testing with first one...")
                description_to_test = descriptions[0]
                
            print(f"🎨 Testing generation for description: {description_to_test['id']}")
            print(f"   Type: {description_to_test['type']}")  
            print(f"   Content: {description_to_test['content'][:100]}...")
            
            # Генерируем изображение
            generation_data = {
                "style_prompt": "fantasy art",
                "width": 1024,
                "height": 768
            }
            
            async with session.post(
                f"http://backend:8000/api/v1/images/generate/description/{description_to_test['id']}",
                headers=headers,
                json=generation_data
            ) as gen_resp:
                print(f"🔄 Generation response status: {gen_resp.status}")
                gen_text = await gen_resp.text()
                print(f"Response text (first 500 chars): {gen_text[:500]}")
                
                if gen_resp.status == 200:
                    gen_result = await gen_resp.json()
                    print("✅ Image generation successful!")
                    print(f"   Image URL: {gen_result.get('image_url', 'N/A')}")
                    print(f"   Generation time: {gen_result.get('generation_time', 'N/A')} seconds")
                    return True
                elif gen_resp.status == 409:
                    print("⚠️  Image already exists (409 Conflict)")
                    return True  # This is expected
                else:
                    print(f"❌ Generation failed with status {gen_resp.status}")
                    try:
                        error_data = await gen_resp.json()
                        print(f"   Error details: {error_data}")
                    except:
                        pass
                    return False
                    
        except Exception as e:
            print(f"❌ Exception occurred: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    success = asyncio.run(test_api_generation())
    sys.exit(0 if success else 1)