# Bulk Data Uploader - Summary

## Live Deployments
- **Frontend**: https://bulk-data-uploader-one.vercel.app
- **Backend**: https://bulk-backend-su46.onrender.com
- **Repository**: https://github.com/suryanshishere/bulk-data-uploader
- **Video and screen share recording**: https://www.loom.com/share/9a4832677324438288cc95a8e73c5aba?sid=cdfa2b9e-23af-4761-afa1-7236f8f62fba

## Objective
- Build a scalable system for uploading and processing large datasets
- Enable real-time user feedback and background processing

## Features
- **File Upload**
  - Supports CSV and Excel
  - Client-side format validation
  - Upload progress bar
- **Asynchronous Processing**
  - Temporary file storage
  - Redis + BullMQ for job queuing
  - Batch processing in a worker thread
- **Real-Time Updates**
  - Socket.io for progress updates
  - Emits data every X% processed
  - Notifies on completion
- **Database Handling**
  - MongoDB with Mongoose
  - Duplicate prevention and validation
  - Tracks success/failure per record
- **User Notifications**
  - Browser alert and email notification
  - Summary report with success/failure counts
- **Infinite Scroll (Task 2 Extension)**
  - Display uploaded files
  - Real-time UI updates
  - Infinite scroll implementation

## Tech Stack

### Frontend
- **Framework**: Next.js (App Router), TypeScript, TailwindCSS
- **Libraries**: 
  - axios
  - socket.io-client
  - react-hook-form
  - react-intersection-observer
  - react-toastify
  - zod
  - clsx
  - react-icons

### Backend
- **Runtime**: Node.js with Express
- **Queue**: BullMQ with Redis
- **Database**: MongoDB with Mongoose
- **Libraries**:
  - multer
  - csv-parser
  - exceljs
  - nodemailer
  - dayjs
  - socket.io
  - dotenv
