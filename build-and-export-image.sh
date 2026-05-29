#!/bin/bash

# Toonflow-app Docker 镜像构建和导出脚本
# 用于构建 Linux/amd64 平台的镜像并导出为 tar 文件

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 默认变量
IMAGE_NAME="toonflow"
OUTPUT_FILE="toonflow-image.tar"
PLATFORM="linux/amd64"
TAG="latest"

# 打印帮助信息
print_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -n, --name NAME     镜像名称 (默认: toonflow)"
    echo "  -t, --tag TAG       镜像标签 (默认: latest)"
    echo "  -o, --output FILE   输出文件名 (默认: toonflow-image.tar)"
    echo "  -p, --platform ARCH 目标平台 (默认: linux/amd64)"
    echo "  -h, --help          显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0                                    # 使用默认参数构建"
    echo "  $0 -n my-toonflow -t v1.0 -o myimage.tar  # 使用自定义参数"
}

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--name)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -p|--platform)
            PLATFORM="$2"
            shift 2
            ;;
        -h|--help)
            print_help
            exit 0
            ;;
        *)
            echo -e "${RED}未知选项: $1${NC}"
            print_help
            exit 1
            ;;
    esac
done

# 完整的镜像名称
FULL_IMAGE_NAME="${IMAGE_NAME}:${TAG}"

echo -e "${GREEN}开始构建 Toonflow-app Docker 镜像...${NC}"
echo -e "${YELLOW}镜像名称:${NC} ${FULL_IMAGE_NAME}"
echo -e "${YELLOW}目标平台:${NC} ${PLATFORM}"
echo -e "${YELLOW}输出文件:${NC} ${OUTPUT_FILE}"

# 检查当前目录是否存在 Dockerfile
if [ ! -f "Dockerfile" ]; then
    echo -e "${RED}错误: 当前目录不存在 Dockerfile${NC}"
    exit 1
fi

# 构建 Docker 镜像
echo -e "\n${GREEN}正在构建 Docker 镜像...${NC}"
docker build --platform "${PLATFORM}" -t "${FULL_IMAGE_NAME}" .

# 验证镜像是否构建成功
if [ $? -ne 0 ]; then
    echo -e "${RED}错误: Docker 镜像构建失败${NC}"
    exit 1
fi

echo -e "${GREEN}Docker 镜像构建成功!${NC}"

# 导出镜像为 tar 文件
echo -e "\n${GREEN}正在导出 Docker 镜像到 ${OUTPUT_FILE}...${NC}"
docker save "${FULL_IMAGE_NAME}" -o "${OUTPUT_FILE}"

# 验证导出是否成功
if [ $? -ne 0 ]; then
    echo -e "${RED}错误: Docker 镜像导出失败${NC}"
    exit 1
fi

# 检查输出文件是否存在
if [ ! -f "${OUTPUT_FILE}" ]; then
    echo -e "${RED}错误: 输出文件未生成${NC}"
    exit 1
fi

# 显示输出文件大小
FILE_SIZE=$(du -h "${OUTPUT_FILE}" | cut -f1)
echo -e "${GREEN}Docker 镜像导出成功!${NC}"
echo -e "${YELLOW}文件:${NC} ${OUTPUT_FILE}"
echo -e "${YELLOW}大小:${NC} ${FILE_SIZE}"

# 提供部署指导
echo -e "\n${GREEN}部署到服务器的步骤:${NC}"
echo "1. 将 ${OUTPUT_FILE} 传输到目标服务器 (例如使用 scp):"
echo "   scp ${OUTPUT_FILE} user@your-server:/path/to/destination/"
echo ""
echo "2. 在目标服务器上加载镜像:"
echo "   docker load -i ${OUTPUT_FILE}"
echo ""
echo "3. 启动容器 (替换端口号和数据卷路径为实际值):"
echo "   docker run -d -p 10588:10588 -v /path/to/local/data:/app/data ${FULL_IMAGE_NAME}"
echo ""
echo "4. 或者使用 docker-compose (推荐):"
echo "   # 在服务器上创建 docker-compose.yml 文件"
echo "   # 确保 /path/to/project/toonflow-compose/data 目录存在"
echo "   docker-compose up -d"
echo ""
echo -e "${GREEN}Toonflow-app 默认访问地址: http://localhost:10588/web/index.html${NC}"
echo -e "${GREEN}首次登录账号: admin / 密码: admin123${NC}"

echo -e "\n${GREEN}脚本执行完成!${NC}"