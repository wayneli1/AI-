-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 创建 profiles (用户信息表)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT,
    company_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建 documents (知识库 / 文件资产表)
CREATE TABLE public.documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建 images (图片库表)
CREATE TABLE public.images (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    image_name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 创建 ai_analysis_reports (智能分析记录表)
CREATE TABLE public.ai_analysis_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    report_type TEXT NOT NULL,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 创建 generated_bids (生成的标书项目表)
CREATE TABLE public.generated_bids (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 开启 RLS (行级安全策略) - 极其重要
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_bids ENABLE ROW LEVEL SECURITY;

-- 为每张表创建基础策略：用户只能对自己的数据进行增删改查
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage own documents" ON public.documents FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own images" ON public.images FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own reports" ON public.ai_analysis_reports FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own bids" ON public.generated_bids FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- 创建触发器：当新用户注册时，自动在 profiles 表中插入记录
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();