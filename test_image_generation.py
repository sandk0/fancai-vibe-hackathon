#!/usr/bin/env python3

import asyncio
import aiohttp
import json
from pprint import pprint

async def test_image_generation():
    """Test image generation API endpoint."""
    
    # First, login to get access token
    login_data = {
        "username": "test@example.com",
        "password": "testpassword123"
    }
    
    async with aiohttp.ClientSession() as session:
        # Login
        login_response = await session.post(
            "http://localhost:8000/api/v1/auth/login",
            data=login_data
        )
        
        if login_response.status != 200:
            print(f"❌ Login failed: {login_response.status}")
            login_text = await login_response.text()
            print(login_text)
            return
            
        login_result = await login_response.json()
        access_token = login_result["tokens"]["access_token"]
        print(f"✅ Login successful, token: {access_token[:20]}...")
        
        # Get a description ID to test with
        headers = {"Authorization": f"Bearer {access_token}"}
        descriptions_response = await session.get(
            "http://localhost:8000/api/v1/books/fadf0c65-f4ab-44fe-8a74-e61264233c76/chapters/1",
            headers=headers
        )
        
        if descriptions_response.status != 200:
            print(f"❌ Failed to get descriptions: {descriptions_response.status}")
            desc_text = await descriptions_response.text()
            print(desc_text)
            return
            
        chapter_data = await descriptions_response.json()
        descriptions = chapter_data.get("descriptions", [])
        
        if not descriptions:
            print("❌ No descriptions found")
            return
            
        # Test image generation for the first description
        test_description = descriptions[0]
        description_id = test_description["id"]
        
        print(f"🎨 Testing image generation for description: {description_id}")
        print(f"Description: {test_description['content'][:100]}...")
        print(f"Type: {test_description['type']}")
        
        # Test image generation
        generation_data = {
            "style_prompt": "fantasy art style",
            "width": 1024,
            "height": 768
        }
        
        generation_response = await session.post(
            f"http://localhost:8000/api/v1/images/generate/description/{description_id}",
            headers=headers,
            json=generation_data
        )
        
        print(f"Generation status: {generation_response.status}")
        generation_text = await generation_response.text()
        print("Generation response:", generation_text[:500])
        
        if generation_response.status == 200:
            generation_result = await generation_response.json()
            print("✅ Image generation successful!")
            pprint(generation_result)
        else:
            print(f"❌ Image generation failed: {generation_response.status}")

if __name__ == "__main__":
    asyncio.run(test_image_generation())