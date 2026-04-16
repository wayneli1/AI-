"""
人员库字段定义
用于智能字段映射的人员库数据结构说明
"""

PERSONNEL_FIELDS_SCHEMA = [
    # ==================== 基本信息 ====================
    {
        "fieldName": "name",
        "fieldLabel": "姓名",
        "fieldType": "string",
        "fieldPath": "name",
        "description": "人员姓名"
    },
    {
        "fieldName": "gender",
        "fieldLabel": "性别",
        "fieldType": "string",
        "fieldPath": "gender",
        "description": "性别（男/女）"
    },
    {
        "fieldName": "birthDate",
        "fieldLabel": "出生日期",
        "fieldType": "date",
        "fieldPath": "birth_date",
        "description": "出生日期，格式：YYYY-MM-DD"
    },
    {
        "fieldName": "idNumber",
        "fieldLabel": "身份证号",
        "fieldType": "string",
        "fieldPath": "id_number",
        "description": "身份证号码"
    },
    {
        "fieldName": "nationality",
        "fieldLabel": "国籍",
        "fieldType": "string",
        "fieldPath": "nationality",
        "description": "国籍"
    },
    {
        "fieldName": "politicalStatus",
        "fieldLabel": "政治面貌",
        "fieldType": "string",
        "fieldPath": "political_status",
        "description": "政治面貌（党员/群众等）"
    },
    
    # ==================== 联系方式 ====================
    {
        "fieldName": "phone",
        "fieldLabel": "手机号",
        "fieldType": "string",
        "fieldPath": "phone",
        "description": "手机号码"
    },
    {
        "fieldName": "email",
        "fieldLabel": "邮箱",
        "fieldType": "string",
        "fieldPath": "email",
        "description": "电子邮箱"
    },
    {
        "fieldName": "address",
        "fieldLabel": "地址",
        "fieldType": "string",
        "fieldPath": "address",
        "description": "联系地址"
    },
    
    # ==================== 教育背景 ====================
    {
        "fieldName": "education",
        "fieldLabel": "学历",
        "fieldType": "string",
        "fieldPath": "education",
        "description": "最高学历（本科/硕士/博士等）"
    },
    {
        "fieldName": "degree",
        "fieldLabel": "学位",
        "fieldType": "string",
        "fieldPath": "degree",
        "description": "学位（学士/硕士/博士）"
    },
    {
        "fieldName": "major",
        "fieldLabel": "专业",
        "fieldType": "string",
        "fieldPath": "major",
        "description": "所学专业"
    },
    {
        "fieldName": "graduationSchool",
        "fieldLabel": "毕业院校",
        "fieldType": "string",
        "fieldPath": "graduation_school",
        "description": "毕业院校名称"
    },
    {
        "fieldName": "graduationDate",
        "fieldLabel": "毕业时间",
        "fieldType": "date",
        "fieldPath": "graduation_date",
        "description": "毕业时间"
    },
    
    # ==================== 职业信息 ====================
    {
        "fieldName": "jobTitle",
        "fieldLabel": "职务",
        "fieldType": "string",
        "fieldPath": "custom_fields.job_positions[0].title",
        "description": "当前职务"
    },
    {
        "fieldName": "professionalTitle",
        "fieldLabel": "职称",
        "fieldType": "string",
        "fieldPath": "professional_title",
        "description": "专业技术职称（高级工程师/工程师等）"
    },
    {
        "fieldName": "department",
        "fieldLabel": "部门",
        "fieldType": "string",
        "fieldPath": "custom_fields.job_positions[0].department",
        "description": "所属部门"
    },
    {
        "fieldName": "employeeId",
        "fieldLabel": "工号",
        "fieldType": "string",
        "fieldPath": "employee_id",
        "description": "员工工号"
    },
    {
        "fieldName": "entryDate",
        "fieldLabel": "入职时间",
        "fieldType": "date",
        "fieldPath": "entry_date",
        "description": "入职日期"
    },
    
    # ==================== 资质证书 ====================
    {
        "fieldName": "certificates",
        "fieldLabel": "证书",
        "fieldType": "array",
        "fieldPath": "custom_fields.certificates[]",
        "description": "持有的证书列表"
    },
    {
        "fieldName": "certificateName",
        "fieldLabel": "证书名称",
        "fieldType": "string",
        "fieldPath": "custom_fields.certificates[].name",
        "description": "证书名称"
    },
    {
        "fieldName": "certificateNumber",
        "fieldLabel": "证书编号",
        "fieldType": "string",
        "fieldPath": "custom_fields.certificates[].number",
        "description": "证书编号"
    },
    {
        "fieldName": "certificateIssueDate",
        "fieldLabel": "发证日期",
        "fieldType": "date",
        "fieldPath": "custom_fields.certificates[].issue_date",
        "description": "证书发证日期"
    },
    
    # ==================== 项目经历 ====================
    {
        "fieldName": "projectExperiences",
        "fieldLabel": "项目经历",
        "fieldType": "array",
        "fieldPath": "custom_fields.job_positions[].project_experiences[]",
        "description": "项目经历列表（嵌套在职位下）"
    },
    {
        "fieldName": "projectName",
        "fieldLabel": "项目名称",
        "fieldType": "string",
        "fieldPath": "custom_fields.job_positions[].project_experiences[].project_name",
        "description": "项目名称"
    },
    {
        "fieldName": "projectRole",
        "fieldLabel": "项目角色",
        "fieldType": "string",
        "fieldPath": "custom_fields.job_positions[].project_experiences[].role",
        "description": "在项目中担任的角色"
    },
    {
        "fieldName": "projectStartDate",
        "fieldLabel": "项目开始时间",
        "fieldType": "date",
        "fieldPath": "custom_fields.job_positions[].project_experiences[].start_date",
        "description": "项目开始日期"
    },
    {
        "fieldName": "projectEndDate",
        "fieldLabel": "项目结束时间",
        "fieldType": "date",
        "fieldPath": "custom_fields.job_positions[].project_experiences[].end_date",
        "description": "项目结束日期"
    },
    {
        "fieldName": "projectDescription",
        "fieldLabel": "项目描述",
        "fieldType": "string",
        "fieldPath": "custom_fields.job_positions[].project_experiences[].description",
        "description": "项目描述"
    },
    {
        "fieldName": "projectAchievements",
        "fieldLabel": "项目业绩",
        "fieldType": "string",
        "fieldPath": "custom_fields.job_positions[].project_experiences[].achievements",
        "description": "项目业绩和成果"
    },
    
    # ==================== 技能特长 ====================
    {
        "fieldName": "skills",
        "fieldLabel": "技能",
        "fieldType": "array",
        "fieldPath": "custom_fields.skills[]",
        "description": "技能列表"
    },
    {
        "fieldName": "specialties",
        "fieldLabel": "专业特长",
        "fieldType": "string",
        "fieldPath": "custom_fields.specialties",
        "description": "专业特长描述"
    },
    
    # ==================== 其他信息 ====================
    {
        "fieldName": "awards",
        "fieldLabel": "获奖情况",
        "fieldType": "array",
        "fieldPath": "custom_fields.awards[]",
        "description": "获奖记录"
    },
    {
        "fieldName": "publications",
        "fieldLabel": "论文著作",
        "fieldType": "array",
        "fieldPath": "custom_fields.publications[]",
        "description": "发表的论文和著作"
    },
    {
        "fieldName": "remarks",
        "fieldLabel": "备注",
        "fieldType": "string",
        "fieldPath": "remarks",
        "description": "其他备注信息"
    }
]


def get_personnel_schema():
    """获取人员库字段定义"""
    return PERSONNEL_FIELDS_SCHEMA


def get_field_by_name(field_name: str):
    """根据字段名获取字段定义"""
    for field in PERSONNEL_FIELDS_SCHEMA:
        if field["fieldName"] == field_name:
            return field
    return None


def get_field_by_label(field_label: str):
    """根据字段标签获取字段定义"""
    for field in PERSONNEL_FIELDS_SCHEMA:
        if field["fieldLabel"] == field_label:
            return field
    return None
