import qrcode from './qrcode-vendor.mjs';
export default function qr(text) {const q=qrcode(0,'M');q.addData(text);q.make();return q.createSvgTag({cellSize:4,margin:8,scalable:true});}
