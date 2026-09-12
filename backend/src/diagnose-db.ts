import mongoose from 'mongoose';
import dns from 'dns';
import { promisify } from 'util';

const MONGODB_URI = 'mongodb+srv://yahiakrr_db_user:4ldEKHOMa8fT0Gw4@cluster0.ri1mrg4.mongodb.net/?appName=Cluster0';

const resolveSrv = promisify(dns.resolveSrv);
const resolveTxt = promisify(dns.resolveTxt);
const lookup = promisify(dns.lookup);

async function diagnose() {
  console.log('--- Database Connection Diagnosis ---');
  console.log('Target URI:', MONGODB_URI.replace(/:([^@]+)@/, ':****@'));

  const hostname = 'cluster0.ri1mrg4.mongodb.net';

  // 1. DNS Lookup
  console.log('\n[1/3] Testing DNS Resolution...');
  try {
    const address = await lookup(hostname);
    console.log(`✓ DNS Lookup successful for ${hostname}:`, address.address);
  } catch (err: any) {
    console.error(`✗ DNS Lookup failed for ${hostname}:`, err.message);
  }

  // 2. SRV Record Verification
  console.log('\n[2/3] Checking SRV Records...');
  try {
    const srvRecords = await resolveSrv('_mongodb._tcp.' + hostname);
    console.log('✓ SRV Records found:');
    srvRecords.forEach(r => console.log(`  - ${r.name}:${r.port} (Priority: ${r.priority}, Weight: ${r.weight})`));
  } catch (err: any) {
    console.error('✗ SRV Record resolution failed:', err.message);
    console.log('  Tip: This often indicates a network-level DNS block or incorrect hostname.');
  }

  // 3. Mongoose Connection Test
  console.log('\n[3/3] Testing Mongoose Connection (timeout 30s)...');
  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
    });
    console.log('✓ Mongoose connection successful!');
    await mongoose.connection.close();
  } catch (err: any) {
    console.error('✗ Mongoose connection failed:', err.message);
    if (err.message.includes('ETIMEDOUT') || err.message.includes('Server selection timed out')) {
      console.log('\n--- DIAGNOSIS: NETWORK TIMEOUT ---');
      console.log('Possible causes:');
      console.log('1. IP Whitelist: Check if your current IP is allowed in MongoDB Atlas Network Access.');
      console.log('2. Firewall: Port 27017 must be open for outgoing connections.');
      console.log('3. ISP/Proxy: Some networks block Atlas clusters.');
    }
  }
}

diagnose();
