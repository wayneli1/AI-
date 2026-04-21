from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from routes import parse_bid, merge_docs, intelligent_mapping, fill_blanks
from dotenv import load_dotenv
import time

# 加载 .env 文件
load_dotenv()

app = FastAPI(
    title="AI Bid Parser API",
    description="标书解析服务 - 表格识别 + 空白扫描 + 文档合并 + 智能字段映射",
    version="2.1.0"
)

# 🔍 调试中间件：记录所有请求
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    print(f"\n🔍 [DEBUG] 收到请求: {request.method} {request.url.path}")
    print(f"🔍 [DEBUG] 来源: {request.client.host}:{request.client.port}")
    print(f"🔍 [DEBUG] Headers: {dict(request.headers)}")
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        print(f"✅ [DEBUG] 响应状态: {response.status_code}, 耗时: {process_time:.2f}s")
        return response
    except Exception as e:
        print(f"❌ [DEBUG] 请求处理异常: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parse_bid.router, prefix="/api", tags=["parser"])
app.include_router(merge_docs.router, prefix="/api", tags=["merge"])
app.include_router(fill_blanks.router, prefix="/api", tags=["fill-blanks"])
app.include_router(intelligent_mapping.router, prefix="/api", tags=["intelligent-mapping"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "bid-parser", "version": "2.0.0"}
