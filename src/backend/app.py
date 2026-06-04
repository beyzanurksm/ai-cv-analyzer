import io
import json

import uvicorn
import pypdf

from fastapi import FastAPI, Header, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types


app = FastAPI(title="AI CV Analyzer Backend Engine")


# Electron frontend'in backend'e istek atabilmesi için CORS ayarı
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalysisRequest(BaseModel):
    cv_text: str
    job_description: str = ""


@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "AI CV Analyzer backend çalışıyor."
    }


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "backend": "running"
    }


@app.post("/api/extract-text")
async def extract_text(file: UploadFile = File(...)):
    try:
        if not file.filename:
            raise HTTPException(
                status_code=400,
                detail="Dosya adı bulunamadı."
            )

        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail="Lütfen sadece PDF formatında dosya yükleyin."
            )

        contents = await file.read()

        if not contents:
            raise HTTPException(
                status_code=400,
                detail="Yüklenen PDF dosyası boş görünüyor."
            )

        pdf_file = io.BytesIO(contents)
        reader = pypdf.PdfReader(pdf_file)

        extracted_text = ""

        for page in reader.pages:
            text = page.extract_text()
            if text:
                extracted_text += text + "\n"

        extracted_text = extracted_text.strip()

        if not extracted_text:
            raise HTTPException(
                status_code=400,
                detail="PDF içinden metin çıkarılamadı. Bu PDF taranmış görsel olabilir."
            )

        return {
            "text": extracted_text,
            "page_count": len(reader.pages)
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"PDF okuma hatası: {str(e)}"
        )


@app.post("/api/analyze")
async def analyze_cv(
    request: AnalysisRequest,
    x_api_key: str = Header(None)
):
    if not x_api_key:
        raise HTTPException(
            status_code=401,
            detail="Gemini API anahtarı eksik. Lütfen API anahtarınızı girin."
        )

    if not request.cv_text or not request.cv_text.strip():
        raise HTTPException(
            status_code=400,
            detail="CV metni boş. Lütfen geçerli bir PDF CV yükleyin."
        )

    try:
        client = genai.Client(api_key=x_api_key)

        system_instruction = (
            "Sen profesyonel bir İK Direktörü, Kıdemli Teknik İşe Alım Uzmanı ve ATS uzmanısın. "
            "Sana verilen CV'yi analiz et ve yapılandırılmış JSON formatında yanıt dön. "
            "Kesinlikle markdown bloğu kullanma. Sadece saf JSON döndür."
        )

        user_prompt = f"""
CV İçeriği:
{request.cv_text}
"""

        if request.job_description and request.job_description.strip():
            user_prompt += f"""
Hedef İş İlanı:
{request.job_description}
"""

        user_prompt += """
Aşağıdaki alanları içeren geçerli bir JSON üret:

{
  "overall_score": 0,
  "key_strengths": [],
  "critical_gaps": [],
  "actionable_suggestions": [],
  "ats_optimization_tips": []
}

Kurallar:
- overall_score 0-100 arası tamsayı olmalı.
- Diğer alanlar string dizisi olmalı.
- JSON dışında açıklama yazma.
- Markdown kullanma.
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json"
            )
        )

        if not response.text:
            raise HTTPException(
                status_code=500,
                detail="Gemini boş yanıt döndürdü."
            )

        try:
            result = json.loads(response.text)
        except json.JSONDecodeError:
            cleaned_text = (
                response.text
                .replace("```json", "")
                .replace("```", "")
                .strip()
            )
            result = json.loads(cleaned_text)

        return {
            "overall_score": int(result.get("overall_score", 0)),
            "key_strengths": result.get("key_strengths", []),
            "critical_gaps": result.get("critical_gaps", []),
            "actionable_suggestions": result.get("actionable_suggestions", []),
            "ats_optimization_tips": result.get("ats_optimization_tips", [])
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gemini API hatası: {str(e)}"
        )


if __name__ == "__main__":
    print("AI CV Analyzer backend başlatılıyor...")
    print("Backend adresi: http://127.0.0.1:5005")

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=5005,
        log_level="info"
    )