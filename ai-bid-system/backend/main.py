from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import parse_bid, merge_docs, intelligent_mapping
from dotenv import load_dotenv

# 加载 .env 文件
load_dotenv()

app = FastAPI(
    title="AI Bid Parser API",
    description="标书解析服务 - 表格识别 + 空白扫描 + 文档合并 + 智能字段映射",
    version="2.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parse_bid.router, prefix="/api", tags=["parser"])
app.include_router(merge_docs.router, prefix="/api", tags=["merge"])
app.include_router(intelligent_mapping.router, prefix="/api", tags=["intelligent-mapping"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "bid-parser", "version": "2.0.0"}
