import {S3} from 'aws-sdk';
const dotenv = <any>require('dotenv');

async function loadS3Env(s3Path:string):Promise<Object> {
  const s3 = new S3();

  try {
    const s3Obj = parseS3Path(s3Path);
    const res = await new Promise<any>((onRes, onErr) => {
      s3.getObject(s3Obj, (err, res) => err ? onErr(err) : onRes(res));
    });
    return dotenv.parse(res.Body.toString('utf8'));
  }
  catch (err) {
    throw new Error(`Failed to load env from ${s3Path}: ${err.message}`);
  }
}


function parseS3Path(s3Path:string):{ Bucket: string, Key: string } {
  const matches = new RegExp('^s3://([^/]+)/(.+)$').exec(s3Path.trim());
  if (!matches) {
    throw new Error(`Invalid s3 path: ${s3Path}`);
  }

  return { Bucket: matches[1], Key: matches[2] };
}

export default loadS3Env;