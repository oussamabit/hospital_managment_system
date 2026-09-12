# 🛠 Troubleshooting & Setup Guide

If you are seeing errors when starting the application, please follow these steps to ensure your local environment is configured correctly.

## 1. Environment Variables

The project requires environment variables that are not tracked in Git for security reasons.

### Backend Setup
1. Navigate to the `backend` directory.
2. Check if a `.env` file exists. If not:
   - Copy `.env.example` to `.env`.
   - Update `MONGODB_URI` with the connection string provided by the project owner.
   - **Shared Database**: To use the same database as your friend, ensure you use their `MONGODB_URI` (from their `.env` file).

### 🌍 MongoDB Atlas & IP Whitelisting (Important!)
If the project uses a shared MongoDB Atlas cluster (like the one in the owner's `.env`):
- **IP Access**: The owner must add your IP address to the "Network Access" list in the MongoDB Atlas dashboard.
- **Connection String**: Use the `mongodb+srv://...` URI in your `.env`.

## 2. MongoDB Connection Error (`ECONNREFUSED 127.0.0.1:27017`)

This error means the backend cannot connect to MongoDB.

- **Using Local MongoDB**: Ensure the MongoDB service is running on your machine.
- **Using MongoDB Atlas**: Ensure your IP address is whitelisted in the Atlas Network Access settings, and that your `MONGODB_URI` in `.env` is correct.
- **Network Issues**: Check if a firewall or VPN is blocking port 27017.

## 3. Vite Proxy Error (`/api/auth/login`)

This error usually occurs because the **Backend is not running** or **failed to start**.

1. **Start the Backend first**:
   ```bash
   cd backend
   npm run dev
   ```
2. Verify the backend console says: `🏥 Hospital RDV Backend running on port 5000`.
3. **Start the Frontend second**:
   ```bash
   cd frontend
   npm run dev
   ```

## 4. Common Fixes

- **Duplicate Schema Index Warning**: This was a code issue that has been fixed in `backend/src/models/RefreshToken.ts`.
- **Node Modules**: If you encounter dependency issues, try deleting `node_modules` and running `npm install` in both `frontend` and `backend` directories.
