#!/bin/bash

# 🚀 BlockReceipt Cursor → Replit Sync Script
# This script syncs all development from Cursor to Replit

echo "🔄 Syncing BlockReceipt development to Replit..."

# Create deployment package
echo "📦 Creating deployment package..."

# Copy all developed components
cp -r ../blockreceipt-pre/server ./backend/
cp -r ../blockreceipt-mobile/src ./mobile/
cp -r ../blockreceipt-frontend/src ./frontend/

# Copy configuration files
cp ../blockreceipt-pre/.env ./config/
cp ../blockreceipt-mobile/.env ./config/mobile.env
cp ../blockreceipt-frontend/.env ./config/frontend.env

# Copy package files
cp ../blockreceipt-pre/package.json ./backend/
cp ../blockreceipt-mobile/package.json ./mobile/
cp ../blockreceipt-frontend/package.json ./frontend/

echo "✅ Deployment package created!"

# Create integration manifest
cat > integration-manifest.json << EOF
{
  "version": "1.0.0",
  "lastSync": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "components": {
    "backend": {
      "path": "./backend/",
      "status": "ready",
      "features": [
        "DALL-E 3 Integration",
        "Cloudflare R2 Storage",
        "Blockchain Minting",
        "Privacy Service",
        "POS Integration",
        "NFT Procurement"
      ]
    },
    "mobile": {
      "path": "./mobile/",
      "status": "ready",
      "features": [
        "React Native App",
        "Modern UI/UX",
        "API Integration",
        "Cloudflare Service"
      ]
    },
    "frontend": {
      "path": "./frontend/",
      "status": "ready",
      "features": [
        "Web Components",
        "User Interface",
        "API Integration"
      ]
    }
  },
  "deployment": {
    "target": "replit",
    "url": "https://block-receiptai-stevendonoghue.replit.app",
    "status": "ready"
  }
}
EOF

echo "📋 Integration manifest created!"

# Create deployment instructions
cat > DEPLOYMENT_INSTRUCTIONS.md << EOF
# 🚀 BlockReceipt Replit Deployment

## 📋 **What's Included:**

### **Backend Services:**
- DALL-E 3 Integration
- Cloudflare R2 Storage
- Blockchain Minting
- Privacy Service
- POS Integration
- NFT Procurement

### **Mobile App:**
- React Native/Expo
- Modern UI/UX
- API Integration
- Cloudflare Service

### **Frontend:**
- Web Components
- User Interface
- API Integration

## 🔧 **Deployment Steps:**

### **1. Environment Setup:**
\`\`\`bash
# Install dependencies
npm install

# Set up environment variables
cp config/.env .env
cp config/mobile.env mobile/.env
cp config/frontend.env frontend/.env
\`\`\`

### **2. Backend Deployment:**
\`\`\`bash
cd backend/
npm install
npm start
\`\`\`

### **3. Frontend Deployment:**
\`\`\`bash
cd frontend/
npm install
npm run build
npm start
\`\`\`

### **4. Mobile App:**
\`\`\`bash
cd mobile/
npm install
npx expo start
\`\`\`

## 🎯 **Integration Testing:**

### **Test Backend:**
- [ ] DALL-E 3 image generation
- [ ] Cloudflare R2 storage
- [ ] Blockchain minting
- [ ] Privacy service
- [ ] POS integration

### **Test Frontend:**
- [ ] User interface
- [ ] API connections
- [ ] Receipt processing
- [ ] NFT generation

### **Test Mobile:**
- [ ] App functionality
- [ ] API integration
- [ ] User experience
- [ ] Performance

## 🚀 **Production Deployment:**

### **Deploy to blockreceipt.ai:**
1. **Backend:** Deploy to Cloudflare Workers
2. **Frontend:** Deploy to Replit
3. **Mobile:** Deploy to app stores
4. **Domain:** Point blockreceipt.ai to Replit

---

**Ready to deploy BlockReceipt!** 🎯
EOF

echo "📖 Deployment instructions created!"

echo "🎉 Sync complete! Ready for Replit deployment."
echo "📋 Next steps:"
echo "1. Push to GitHub"
echo "2. Pull in Replit"
echo "3. Deploy to blockreceipt.ai"
