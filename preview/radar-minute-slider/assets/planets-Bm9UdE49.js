import{s as ad}from"./index-DzInfC6E.js";const Oo="183",AM={ROTATE:0,DOLLY:1,PAN:2},TM={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},od=0,ml=1,ld=2,ps=1,cd=2,gr=3,zn=0,zt=1,nn=2,Bn=0,zi=1,_l=2,gl=3,Ml=4,ud=5,hi=100,dd=101,hd=102,fd=103,pd=104,md=200,_d=201,gd=202,Md=203,Na=204,Oa=205,xd=206,Sd=207,vd=208,Ed=209,yd=210,bd=211,Ad=212,Td=213,Rd=214,Da=0,Ua=1,Fa=2,Vi=3,Ba=4,ka=5,za=6,Ha=7,Do=0,Cd=1,Ld=2,gn=0,ru=1,su=2,au=3,ou=4,lu=5,cu=6,uu=7,xl="attached",wd="detached",du=300,mi=301,Wi=302,Gs=303,Vs=304,Ls=306,Xi=1e3,pn=1001,vs=1002,St=1003,hu=1004,Mr=1005,vt=1006,ms=1007,On=1008,Wt=1009,fu=1010,pu=1011,br=1012,Uo=1013,xn=1014,Qt=1015,Hn=1016,Fo=1017,Bo=1018,Ar=1020,mu=35902,_u=35899,gu=1021,Mu=1022,Yt=1023,Gn=1026,pi=1027,ko=1028,zo=1029,Ki=1030,Ho=1031,Go=1033,_s=33776,gs=33777,Ms=33778,xs=33779,Ga=35840,Va=35841,Wa=35842,Xa=35843,Ka=36196,qa=37492,ja=37496,Qa=37488,Ya=37489,Za=37490,Ja=37491,$a=37808,eo=37809,to=37810,no=37811,io=37812,ro=37813,so=37814,ao=37815,oo=37816,lo=37817,co=37818,uo=37819,ho=37820,fo=37821,po=36492,mo=36494,_o=36495,go=36283,Mo=36284,xo=36285,So=36286,Tr=2300,Rr=2301,Ws=2302,Sl=2303,vl=2400,El=2401,yl=2402,Pd=2500,Id=0,xu=1,vo=2,Nd=3200,Vo=0,Od=1,Nn="",dt="srgb",Dt="srgb-linear",Es="linear",Ze="srgb",Si=7680,bl=519,Dd=512,Ud=513,Fd=514,Wo=515,Bd=516,kd=517,Xo=518,zd=519,Eo=35044,Al="300 es",mn=2e3,Cr=2001;function Hd(r){for(let e=r.length-1;e>=0;--e)if(r[e]>=65535)return!0;return!1}function Gd(r){return ArrayBuffer.isView(r)&&!(r instanceof DataView)}function Lr(r){return document.createElementNS("http://www.w3.org/1999/xhtml",r)}function Vd(){const r=Lr("canvas");return r.style.display="block",r}const Tl={};function ys(...r){const e="THREE."+r.shift();console.log(e,...r)}function Su(r){const e=r[0];if(typeof e=="string"&&e.startsWith("TSL:")){const t=r[1];t&&t.isStackTrace?r[0]+=" "+t.getLocation():r[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return r}function ye(...r){r=Su(r);const e="THREE."+r.shift();{const t=r[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...r)}}function Te(...r){r=Su(r);const e="THREE."+r.shift();{const t=r[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...r)}}function bs(...r){const e=r.join(" ");e in Tl||(Tl[e]=!0,ye(...r))}function Wd(r,e,t){return new Promise(function(n,i){function s(){switch(r.clientWaitSync(e,r.SYNC_FLUSH_COMMANDS_BIT,0)){case r.WAIT_FAILED:i();break;case r.TIMEOUT_EXPIRED:setTimeout(s,t);break;default:n()}}setTimeout(s,t)})}const Xd={[Da]:Ua,[Fa]:za,[Ba]:Ha,[Vi]:ka,[Ua]:Da,[za]:Fa,[Ha]:Ba,[ka]:Vi};class _i{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){const n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){const n=this._listeners;if(n===void 0)return;const i=n[e];if(i!==void 0){const s=i.indexOf(t);s!==-1&&i.splice(s,1)}}dispatchEvent(e){const t=this._listeners;if(t===void 0)return;const n=t[e.type];if(n!==void 0){e.target=this;const i=n.slice(0);for(let s=0,a=i.length;s<a;s++)i[s].call(this,e);e.target=null}}}const Nt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let Rl=1234567;const Sr=Math.PI/180,qi=180/Math.PI;function sn(){const r=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Nt[r&255]+Nt[r>>8&255]+Nt[r>>16&255]+Nt[r>>24&255]+"-"+Nt[e&255]+Nt[e>>8&255]+"-"+Nt[e>>16&15|64]+Nt[e>>24&255]+"-"+Nt[t&63|128]+Nt[t>>8&255]+"-"+Nt[t>>16&255]+Nt[t>>24&255]+Nt[n&255]+Nt[n>>8&255]+Nt[n>>16&255]+Nt[n>>24&255]).toLowerCase()}function Ge(r,e,t){return Math.max(e,Math.min(t,r))}function Ko(r,e){return(r%e+e)%e}function Kd(r,e,t,n,i){return n+(r-e)*(i-n)/(t-e)}function qd(r,e,t){return r!==e?(t-r)/(e-r):0}function vr(r,e,t){return(1-t)*r+t*e}function jd(r,e,t,n){return vr(r,e,1-Math.exp(-t*n))}function Qd(r,e=1){return e-Math.abs(Ko(r,e*2)-e)}function Yd(r,e,t){return r<=e?0:r>=t?1:(r=(r-e)/(t-e),r*r*(3-2*r))}function Zd(r,e,t){return r<=e?0:r>=t?1:(r=(r-e)/(t-e),r*r*r*(r*(r*6-15)+10))}function Jd(r,e){return r+Math.floor(Math.random()*(e-r+1))}function $d(r,e){return r+Math.random()*(e-r)}function eh(r){return r*(.5-Math.random())}function th(r){r!==void 0&&(Rl=r);let e=Rl+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function nh(r){return r*Sr}function ih(r){return r*qi}function rh(r){return(r&r-1)===0&&r!==0}function sh(r){return Math.pow(2,Math.ceil(Math.log(r)/Math.LN2))}function ah(r){return Math.pow(2,Math.floor(Math.log(r)/Math.LN2))}function oh(r,e,t,n,i){const s=Math.cos,a=Math.sin,o=s(t/2),l=a(t/2),c=s((e+n)/2),u=a((e+n)/2),h=s((e-n)/2),d=a((e-n)/2),f=s((n-e)/2),_=a((n-e)/2);switch(i){case"XYX":r.set(o*u,l*h,l*d,o*c);break;case"YZY":r.set(l*d,o*u,l*h,o*c);break;case"ZXZ":r.set(l*h,l*d,o*u,o*c);break;case"XZX":r.set(o*u,l*_,l*f,o*c);break;case"YXY":r.set(l*f,o*u,l*_,o*c);break;case"ZYZ":r.set(l*_,l*f,o*u,o*c);break;default:ye("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+i)}}function rn(r,e){switch(e.constructor){case Float32Array:return r;case Uint32Array:return r/4294967295;case Uint16Array:return r/65535;case Uint8Array:return r/255;case Int32Array:return Math.max(r/2147483647,-1);case Int16Array:return Math.max(r/32767,-1);case Int8Array:return Math.max(r/127,-1);default:throw new Error("Invalid component type.")}}function Je(r,e){switch(e.constructor){case Float32Array:return r;case Uint32Array:return Math.round(r*4294967295);case Uint16Array:return Math.round(r*65535);case Uint8Array:return Math.round(r*255);case Int32Array:return Math.round(r*2147483647);case Int16Array:return Math.round(r*32767);case Int8Array:return Math.round(r*127);default:throw new Error("Invalid component type.")}}const lh={DEG2RAD:Sr,RAD2DEG:qi,generateUUID:sn,clamp:Ge,euclideanModulo:Ko,mapLinear:Kd,inverseLerp:qd,lerp:vr,damp:jd,pingpong:Qd,smoothstep:Yd,smootherstep:Zd,randInt:Jd,randFloat:$d,randFloatSpread:eh,seededRandom:th,degToRad:nh,radToDeg:ih,isPowerOfTwo:rh,ceilPowerOfTwo:sh,floorPowerOfTwo:ah,setQuaternionFromProperEuler:oh,normalize:Je,denormalize:rn};class Ie{constructor(e=0,t=0){Ie.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,n=this.y,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6],this.y=i[1]*t+i[4]*n+i[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Ge(this.x,e.x,t.x),this.y=Ge(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=Ge(this.x,e,t),this.y=Ge(this.y,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Ge(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(Ge(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const n=Math.cos(t),i=Math.sin(t),s=this.x-e.x,a=this.y-e.y;return this.x=s*n-a*i+e.x,this.y=s*i+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class vn{constructor(e=0,t=0,n=0,i=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=i}static slerpFlat(e,t,n,i,s,a,o){let l=n[i+0],c=n[i+1],u=n[i+2],h=n[i+3],d=s[a+0],f=s[a+1],_=s[a+2],g=s[a+3];if(h!==g||l!==d||c!==f||u!==_){let m=l*d+c*f+u*_+h*g;m<0&&(d=-d,f=-f,_=-_,g=-g,m=-m);let p=1-o;if(m<.9995){const v=Math.acos(m),y=Math.sin(v);p=Math.sin(p*v)/y,o=Math.sin(o*v)/y,l=l*p+d*o,c=c*p+f*o,u=u*p+_*o,h=h*p+g*o}else{l=l*p+d*o,c=c*p+f*o,u=u*p+_*o,h=h*p+g*o;const v=1/Math.sqrt(l*l+c*c+u*u+h*h);l*=v,c*=v,u*=v,h*=v}}e[t]=l,e[t+1]=c,e[t+2]=u,e[t+3]=h}static multiplyQuaternionsFlat(e,t,n,i,s,a){const o=n[i],l=n[i+1],c=n[i+2],u=n[i+3],h=s[a],d=s[a+1],f=s[a+2],_=s[a+3];return e[t]=o*_+u*h+l*f-c*d,e[t+1]=l*_+u*d+c*h-o*f,e[t+2]=c*_+u*f+o*d-l*h,e[t+3]=u*_-o*h-l*d-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,i){return this._x=e,this._y=t,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const n=e._x,i=e._y,s=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(n/2),u=o(i/2),h=o(s/2),d=l(n/2),f=l(i/2),_=l(s/2);switch(a){case"XYZ":this._x=d*u*h+c*f*_,this._y=c*f*h-d*u*_,this._z=c*u*_+d*f*h,this._w=c*u*h-d*f*_;break;case"YXZ":this._x=d*u*h+c*f*_,this._y=c*f*h-d*u*_,this._z=c*u*_-d*f*h,this._w=c*u*h+d*f*_;break;case"ZXY":this._x=d*u*h-c*f*_,this._y=c*f*h+d*u*_,this._z=c*u*_+d*f*h,this._w=c*u*h-d*f*_;break;case"ZYX":this._x=d*u*h-c*f*_,this._y=c*f*h+d*u*_,this._z=c*u*_-d*f*h,this._w=c*u*h+d*f*_;break;case"YZX":this._x=d*u*h+c*f*_,this._y=c*f*h+d*u*_,this._z=c*u*_-d*f*h,this._w=c*u*h-d*f*_;break;case"XZY":this._x=d*u*h-c*f*_,this._y=c*f*h-d*u*_,this._z=c*u*_+d*f*h,this._w=c*u*h+d*f*_;break;default:ye("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const n=t/2,i=Math.sin(n);return this._x=e.x*i,this._y=e.y*i,this._z=e.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,n=t[0],i=t[4],s=t[8],a=t[1],o=t[5],l=t[9],c=t[2],u=t[6],h=t[10],d=n+o+h;if(d>0){const f=.5/Math.sqrt(d+1);this._w=.25/f,this._x=(u-l)*f,this._y=(s-c)*f,this._z=(a-i)*f}else if(n>o&&n>h){const f=2*Math.sqrt(1+n-o-h);this._w=(u-l)/f,this._x=.25*f,this._y=(i+a)/f,this._z=(s+c)/f}else if(o>h){const f=2*Math.sqrt(1+o-n-h);this._w=(s-c)/f,this._x=(i+a)/f,this._y=.25*f,this._z=(l+u)/f}else{const f=2*Math.sqrt(1+h-n-o);this._w=(a-i)/f,this._x=(s+c)/f,this._y=(l+u)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(Ge(this.dot(e),-1,1)))}rotateTowards(e,t){const n=this.angleTo(e);if(n===0)return this;const i=Math.min(1,t/n);return this.slerp(e,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const n=e._x,i=e._y,s=e._z,a=e._w,o=t._x,l=t._y,c=t._z,u=t._w;return this._x=n*u+a*o+i*c-s*l,this._y=i*u+a*l+s*o-n*c,this._z=s*u+a*c+n*l-i*o,this._w=a*u-n*o-i*l-s*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,i=e._y,s=e._z,a=e._w,o=this.dot(e);o<0&&(n=-n,i=-i,s=-s,a=-a,o=-o);let l=1-t;if(o<.9995){const c=Math.acos(o),u=Math.sin(c);l=Math.sin(l*c)/u,t=Math.sin(t*c)/u,this._x=this._x*l+n*t,this._y=this._y*l+i*t,this._z=this._z*l+s*t,this._w=this._w*l+a*t,this._onChangeCallback()}else this._x=this._x*l+n*t,this._y=this._y*l+i*t,this._z=this._z*l+s*t,this._w=this._w*l+a*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),s=Math.sqrt(n);return this.set(i*Math.sin(e),i*Math.cos(e),s*Math.sin(t),s*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class I{constructor(e=0,t=0,n=0){I.prototype.isVector3=!0,this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Cl.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Cl.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,n=this.y,i=this.z,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6]*i,this.y=s[1]*t+s[4]*n+s[7]*i,this.z=s[2]*t+s[5]*n+s[8]*i,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,n=this.y,i=this.z,s=e.elements,a=1/(s[3]*t+s[7]*n+s[11]*i+s[15]);return this.x=(s[0]*t+s[4]*n+s[8]*i+s[12])*a,this.y=(s[1]*t+s[5]*n+s[9]*i+s[13])*a,this.z=(s[2]*t+s[6]*n+s[10]*i+s[14])*a,this}applyQuaternion(e){const t=this.x,n=this.y,i=this.z,s=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*i-o*n),u=2*(o*t-s*i),h=2*(s*n-a*t);return this.x=t+l*c+a*h-o*u,this.y=n+l*u+o*c-s*h,this.z=i+l*h+s*u-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,n=this.y,i=this.z,s=e.elements;return this.x=s[0]*t+s[4]*n+s[8]*i,this.y=s[1]*t+s[5]*n+s[9]*i,this.z=s[2]*t+s[6]*n+s[10]*i,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Ge(this.x,e.x,t.x),this.y=Ge(this.y,e.y,t.y),this.z=Ge(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=Ge(this.x,e,t),this.y=Ge(this.y,e,t),this.z=Ge(this.z,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Ge(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const n=e.x,i=e.y,s=e.z,a=t.x,o=t.y,l=t.z;return this.x=i*l-s*o,this.y=s*a-n*l,this.z=n*o-i*a,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Xs.copy(this).projectOnVector(e),this.sub(Xs)}reflect(e){return this.sub(Xs.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(Ge(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y,i=this.z-e.z;return t*t+n*n+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){const i=Math.sin(t)*e;return this.x=i*Math.sin(n),this.y=Math.cos(t)*e,this.z=i*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),i=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=i,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Xs=new I,Cl=new vn;class Ue{constructor(e,t,n,i,s,a,o,l,c){Ue.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,i,s,a,o,l,c)}set(e,t,n,i,s,a,o,l,c){const u=this.elements;return u[0]=e,u[1]=i,u[2]=o,u[3]=t,u[4]=s,u[5]=l,u[6]=n,u[7]=a,u[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,i=t.elements,s=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],u=n[4],h=n[7],d=n[2],f=n[5],_=n[8],g=i[0],m=i[3],p=i[6],v=i[1],y=i[4],E=i[7],R=i[2],T=i[5],L=i[8];return s[0]=a*g+o*v+l*R,s[3]=a*m+o*y+l*T,s[6]=a*p+o*E+l*L,s[1]=c*g+u*v+h*R,s[4]=c*m+u*y+h*T,s[7]=c*p+u*E+h*L,s[2]=d*g+f*v+_*R,s[5]=d*m+f*y+_*T,s[8]=d*p+f*E+_*L,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[1],i=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8];return t*a*u-t*o*c-n*s*u+n*o*l+i*s*c-i*a*l}invert(){const e=this.elements,t=e[0],n=e[1],i=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8],h=u*a-o*c,d=o*l-u*s,f=c*s-a*l,_=t*h+n*d+i*f;if(_===0)return this.set(0,0,0,0,0,0,0,0,0);const g=1/_;return e[0]=h*g,e[1]=(i*c-u*n)*g,e[2]=(o*n-i*a)*g,e[3]=d*g,e[4]=(u*t-i*l)*g,e[5]=(i*s-o*t)*g,e[6]=f*g,e[7]=(n*l-c*t)*g,e[8]=(a*t-n*s)*g,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,i,s,a,o){const l=Math.cos(s),c=Math.sin(s);return this.set(n*l,n*c,-n*(l*a+c*o)+a+e,-i*c,i*l,-i*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return this.premultiply(Ks.makeScale(e,t)),this}rotate(e){return this.premultiply(Ks.makeRotation(-e)),this}translate(e,t){return this.premultiply(Ks.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,n=e.elements;for(let i=0;i<9;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const Ks=new Ue,Ll=new Ue().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),wl=new Ue().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function ch(){const r={enabled:!0,workingColorSpace:Dt,spaces:{},convert:function(i,s,a){return this.enabled===!1||s===a||!s||!a||(this.spaces[s].transfer===Ze&&(i.r=kn(i.r),i.g=kn(i.g),i.b=kn(i.b)),this.spaces[s].primaries!==this.spaces[a].primaries&&(i.applyMatrix3(this.spaces[s].toXYZ),i.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===Ze&&(i.r=Hi(i.r),i.g=Hi(i.g),i.b=Hi(i.b))),i},workingToColorSpace:function(i,s){return this.convert(i,this.workingColorSpace,s)},colorSpaceToWorking:function(i,s){return this.convert(i,s,this.workingColorSpace)},getPrimaries:function(i){return this.spaces[i].primaries},getTransfer:function(i){return i===Nn?Es:this.spaces[i].transfer},getToneMappingMode:function(i){return this.spaces[i].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(i,s=this.workingColorSpace){return i.fromArray(this.spaces[s].luminanceCoefficients)},define:function(i){Object.assign(this.spaces,i)},_getMatrix:function(i,s,a){return i.copy(this.spaces[s].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(i){return this.spaces[i].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(i=this.workingColorSpace){return this.spaces[i].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(i,s){return bs("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),r.workingToColorSpace(i,s)},toWorkingColorSpace:function(i,s){return bs("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),r.colorSpaceToWorking(i,s)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return r.define({[Dt]:{primaries:e,whitePoint:n,transfer:Es,toXYZ:Ll,fromXYZ:wl,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:dt},outputColorSpaceConfig:{drawingBufferColorSpace:dt}},[dt]:{primaries:e,whitePoint:n,transfer:Ze,toXYZ:Ll,fromXYZ:wl,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:dt}}}),r}const Xe=ch();function kn(r){return r<.04045?r*.0773993808:Math.pow(r*.9478672986+.0521327014,2.4)}function Hi(r){return r<.0031308?r*12.92:1.055*Math.pow(r,.41666)-.055}let vi;class uh{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{vi===void 0&&(vi=Lr("canvas")),vi.width=e.width,vi.height=e.height;const i=vi.getContext("2d");e instanceof ImageData?i.putImageData(e,0,0):i.drawImage(e,0,0,e.width,e.height),n=vi}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=Lr("canvas");t.width=e.width,t.height=e.height;const n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);const i=n.getImageData(0,0,e.width,e.height),s=i.data;for(let a=0;a<s.length;a++)s[a]=kn(s[a]/255)*255;return n.putImageData(i,0,0),t}else if(e.data){const t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(kn(t[n]/255)*255):t[n]=kn(t[n]);return{data:t,width:e.width,height:e.height}}else return ye("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let dh=0;class qo{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:dh++}),this.uuid=sn(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){const t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayHeight,t.displayWidth,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let s;if(Array.isArray(i)){s=[];for(let a=0,o=i.length;a<o;a++)i[a].isDataTexture?s.push(qs(i[a].image)):s.push(qs(i[a]))}else s=qs(i);n.url=s}return t||(e.images[this.uuid]=n),n}}function qs(r){return typeof HTMLImageElement<"u"&&r instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&r instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&r instanceof ImageBitmap?uh.getDataURL(r):r.data?{data:Array.from(r.data),width:r.width,height:r.height,type:r.data.constructor.name}:(ye("Texture: Unable to serialize Texture."),{})}let hh=0;const js=new I;class Et extends _i{constructor(e=Et.DEFAULT_IMAGE,t=Et.DEFAULT_MAPPING,n=pn,i=pn,s=vt,a=On,o=Yt,l=Wt,c=Et.DEFAULT_ANISOTROPY,u=Nn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:hh++}),this.uuid=sn(),this.name="",this.source=new qo(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=s,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new Ie(0,0),this.repeat=new Ie(1,1),this.center=new Ie(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ue,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0}get width(){return this.source.getSize(js).x}get height(){return this.source.getSize(js).y}get depth(){return this.source.getSize(js).z}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(const t in e){const n=e[t];if(n===void 0){ye(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}const i=this[t];if(i===void 0){ye(`Texture.setValues(): property '${t}' does not exist.`);continue}i&&n&&i.isVector2&&n.isVector2||i&&n&&i.isVector3&&n.isVector3||i&&n&&i.isMatrix3&&n.isMatrix3?i.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==du)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Xi:e.x=e.x-Math.floor(e.x);break;case pn:e.x=e.x<0?0:1;break;case vs:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Xi:e.y=e.y-Math.floor(e.y);break;case pn:e.y=e.y<0?0:1;break;case vs:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}Et.DEFAULT_IMAGE=null;Et.DEFAULT_MAPPING=du;Et.DEFAULT_ANISOTROPY=1;class lt{constructor(e=0,t=0,n=0,i=1){lt.prototype.isVector4=!0,this.x=e,this.y=t,this.z=n,this.w=i}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,i){return this.x=e,this.y=t,this.z=n,this.w=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,n=this.y,i=this.z,s=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*i+a[12]*s,this.y=a[1]*t+a[5]*n+a[9]*i+a[13]*s,this.z=a[2]*t+a[6]*n+a[10]*i+a[14]*s,this.w=a[3]*t+a[7]*n+a[11]*i+a[15]*s,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,i,s;const l=e.elements,c=l[0],u=l[4],h=l[8],d=l[1],f=l[5],_=l[9],g=l[2],m=l[6],p=l[10];if(Math.abs(u-d)<.01&&Math.abs(h-g)<.01&&Math.abs(_-m)<.01){if(Math.abs(u+d)<.1&&Math.abs(h+g)<.1&&Math.abs(_+m)<.1&&Math.abs(c+f+p-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const y=(c+1)/2,E=(f+1)/2,R=(p+1)/2,T=(u+d)/4,L=(h+g)/4,x=(_+m)/4;return y>E&&y>R?y<.01?(n=0,i=.707106781,s=.707106781):(n=Math.sqrt(y),i=T/n,s=L/n):E>R?E<.01?(n=.707106781,i=0,s=.707106781):(i=Math.sqrt(E),n=T/i,s=x/i):R<.01?(n=.707106781,i=.707106781,s=0):(s=Math.sqrt(R),n=L/s,i=x/s),this.set(n,i,s,t),this}let v=Math.sqrt((m-_)*(m-_)+(h-g)*(h-g)+(d-u)*(d-u));return Math.abs(v)<.001&&(v=1),this.x=(m-_)/v,this.y=(h-g)/v,this.z=(d-u)/v,this.w=Math.acos((c+f+p-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Ge(this.x,e.x,t.x),this.y=Ge(this.y,e.y,t.y),this.z=Ge(this.z,e.z,t.z),this.w=Ge(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=Ge(this.x,e,t),this.y=Ge(this.y,e,t),this.z=Ge(this.z,e,t),this.w=Ge(this.w,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Ge(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class fh extends _i{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:vt,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new lt(0,0,e,t),this.scissorTest=!1,this.viewport=new lt(0,0,e,t),this.textures=[];const i={width:e,height:t,depth:n.depth},s=new Et(i),a=n.count;for(let o=0;o<a;o++)this.textures[o]=s.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview}_setTextureOptions(e={}){const t={minFilter:vt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let i=0,s=this.textures.length;i<s;i++)this.textures[i].image.width=e,this.textures[i].image.height=t,this.textures[i].image.depth=n,this.textures[i].isData3DTexture!==!0&&(this.textures[i].isArrayTexture=this.textures[i].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;const i=Object.assign({},e.textures[t].image);this.textures[t].source=new qo(i)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Mn extends fh{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}}class vu extends Et{constructor(e=null,t=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=St,this.minFilter=St,this.wrapR=pn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class ph extends Et{constructor(e=null,t=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=St,this.minFilter=St,this.wrapR=pn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Ne{constructor(e,t,n,i,s,a,o,l,c,u,h,d,f,_,g,m){Ne.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,i,s,a,o,l,c,u,h,d,f,_,g,m)}set(e,t,n,i,s,a,o,l,c,u,h,d,f,_,g,m){const p=this.elements;return p[0]=e,p[4]=t,p[8]=n,p[12]=i,p[1]=s,p[5]=a,p[9]=o,p[13]=l,p[2]=c,p[6]=u,p[10]=h,p[14]=d,p[3]=f,p[7]=_,p[11]=g,p[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Ne().fromArray(this.elements)}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){const t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinant()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinant()===0)return this.identity();const t=this.elements,n=e.elements,i=1/Ei.setFromMatrixColumn(e,0).length(),s=1/Ei.setFromMatrixColumn(e,1).length(),a=1/Ei.setFromMatrixColumn(e,2).length();return t[0]=n[0]*i,t[1]=n[1]*i,t[2]=n[2]*i,t[3]=0,t[4]=n[4]*s,t[5]=n[5]*s,t[6]=n[6]*s,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,n=e.x,i=e.y,s=e.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(i),c=Math.sin(i),u=Math.cos(s),h=Math.sin(s);if(e.order==="XYZ"){const d=a*u,f=a*h,_=o*u,g=o*h;t[0]=l*u,t[4]=-l*h,t[8]=c,t[1]=f+_*c,t[5]=d-g*c,t[9]=-o*l,t[2]=g-d*c,t[6]=_+f*c,t[10]=a*l}else if(e.order==="YXZ"){const d=l*u,f=l*h,_=c*u,g=c*h;t[0]=d+g*o,t[4]=_*o-f,t[8]=a*c,t[1]=a*h,t[5]=a*u,t[9]=-o,t[2]=f*o-_,t[6]=g+d*o,t[10]=a*l}else if(e.order==="ZXY"){const d=l*u,f=l*h,_=c*u,g=c*h;t[0]=d-g*o,t[4]=-a*h,t[8]=_+f*o,t[1]=f+_*o,t[5]=a*u,t[9]=g-d*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){const d=a*u,f=a*h,_=o*u,g=o*h;t[0]=l*u,t[4]=_*c-f,t[8]=d*c+g,t[1]=l*h,t[5]=g*c+d,t[9]=f*c-_,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){const d=a*l,f=a*c,_=o*l,g=o*c;t[0]=l*u,t[4]=g-d*h,t[8]=_*h+f,t[1]=h,t[5]=a*u,t[9]=-o*u,t[2]=-c*u,t[6]=f*h+_,t[10]=d-g*h}else if(e.order==="XZY"){const d=a*l,f=a*c,_=o*l,g=o*c;t[0]=l*u,t[4]=-h,t[8]=c*u,t[1]=d*h+g,t[5]=a*u,t[9]=f*h-_,t[2]=_*h-f,t[6]=o*u,t[10]=g*h+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(mh,e,_h)}lookAt(e,t,n){const i=this.elements;return Gt.subVectors(e,t),Gt.lengthSq()===0&&(Gt.z=1),Gt.normalize(),Kn.crossVectors(n,Gt),Kn.lengthSq()===0&&(Math.abs(n.z)===1?Gt.x+=1e-4:Gt.z+=1e-4,Gt.normalize(),Kn.crossVectors(n,Gt)),Kn.normalize(),Fr.crossVectors(Gt,Kn),i[0]=Kn.x,i[4]=Fr.x,i[8]=Gt.x,i[1]=Kn.y,i[5]=Fr.y,i[9]=Gt.y,i[2]=Kn.z,i[6]=Fr.z,i[10]=Gt.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,i=t.elements,s=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],u=n[1],h=n[5],d=n[9],f=n[13],_=n[2],g=n[6],m=n[10],p=n[14],v=n[3],y=n[7],E=n[11],R=n[15],T=i[0],L=i[4],x=i[8],b=i[12],V=i[1],C=i[5],D=i[9],U=i[13],H=i[2],G=i[6],B=i[10],z=i[14],$=i[3],Y=i[7],ce=i[11],pe=i[15];return s[0]=a*T+o*V+l*H+c*$,s[4]=a*L+o*C+l*G+c*Y,s[8]=a*x+o*D+l*B+c*ce,s[12]=a*b+o*U+l*z+c*pe,s[1]=u*T+h*V+d*H+f*$,s[5]=u*L+h*C+d*G+f*Y,s[9]=u*x+h*D+d*B+f*ce,s[13]=u*b+h*U+d*z+f*pe,s[2]=_*T+g*V+m*H+p*$,s[6]=_*L+g*C+m*G+p*Y,s[10]=_*x+g*D+m*B+p*ce,s[14]=_*b+g*U+m*z+p*pe,s[3]=v*T+y*V+E*H+R*$,s[7]=v*L+y*C+E*G+R*Y,s[11]=v*x+y*D+E*B+R*ce,s[15]=v*b+y*U+E*z+R*pe,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[4],i=e[8],s=e[12],a=e[1],o=e[5],l=e[9],c=e[13],u=e[2],h=e[6],d=e[10],f=e[14],_=e[3],g=e[7],m=e[11],p=e[15],v=l*f-c*d,y=o*f-c*h,E=o*d-l*h,R=a*f-c*u,T=a*d-l*u,L=a*h-o*u;return t*(g*v-m*y+p*E)-n*(_*v-m*R+p*T)+i*(_*y-g*R+p*L)-s*(_*E-g*T+m*L)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){const i=this.elements;return e.isVector3?(i[12]=e.x,i[13]=e.y,i[14]=e.z):(i[12]=e,i[13]=t,i[14]=n),this}invert(){const e=this.elements,t=e[0],n=e[1],i=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8],h=e[9],d=e[10],f=e[11],_=e[12],g=e[13],m=e[14],p=e[15],v=t*o-n*a,y=t*l-i*a,E=t*c-s*a,R=n*l-i*o,T=n*c-s*o,L=i*c-s*l,x=u*g-h*_,b=u*m-d*_,V=u*p-f*_,C=h*m-d*g,D=h*p-f*g,U=d*p-f*m,H=v*U-y*D+E*C+R*V-T*b+L*x;if(H===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const G=1/H;return e[0]=(o*U-l*D+c*C)*G,e[1]=(i*D-n*U-s*C)*G,e[2]=(g*L-m*T+p*R)*G,e[3]=(d*T-h*L-f*R)*G,e[4]=(l*V-a*U-c*b)*G,e[5]=(t*U-i*V+s*b)*G,e[6]=(m*E-_*L-p*y)*G,e[7]=(u*L-d*E+f*y)*G,e[8]=(a*D-o*V+c*x)*G,e[9]=(n*V-t*D-s*x)*G,e[10]=(_*T-g*E+p*v)*G,e[11]=(h*E-u*T-f*v)*G,e[12]=(o*b-a*C-l*x)*G,e[13]=(t*C-n*b+i*x)*G,e[14]=(g*y-_*R-m*v)*G,e[15]=(u*R-h*y+d*v)*G,this}scale(e){const t=this.elements,n=e.x,i=e.y,s=e.z;return t[0]*=n,t[4]*=i,t[8]*=s,t[1]*=n,t[5]*=i,t[9]*=s,t[2]*=n,t[6]*=i,t[10]*=s,t[3]*=n,t[7]*=i,t[11]*=s,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],i=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,i))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const n=Math.cos(t),i=Math.sin(t),s=1-n,a=e.x,o=e.y,l=e.z,c=s*a,u=s*o;return this.set(c*a+n,c*o-i*l,c*l+i*o,0,c*o+i*l,u*o+n,u*l-i*a,0,c*l-i*o,u*l+i*a,s*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,i,s,a){return this.set(1,n,s,0,e,1,a,0,t,i,1,0,0,0,0,1),this}compose(e,t,n){const i=this.elements,s=t._x,a=t._y,o=t._z,l=t._w,c=s+s,u=a+a,h=o+o,d=s*c,f=s*u,_=s*h,g=a*u,m=a*h,p=o*h,v=l*c,y=l*u,E=l*h,R=n.x,T=n.y,L=n.z;return i[0]=(1-(g+p))*R,i[1]=(f+E)*R,i[2]=(_-y)*R,i[3]=0,i[4]=(f-E)*T,i[5]=(1-(d+p))*T,i[6]=(m+v)*T,i[7]=0,i[8]=(_+y)*L,i[9]=(m-v)*L,i[10]=(1-(d+g))*L,i[11]=0,i[12]=e.x,i[13]=e.y,i[14]=e.z,i[15]=1,this}decompose(e,t,n){const i=this.elements;e.x=i[12],e.y=i[13],e.z=i[14];const s=this.determinant();if(s===0)return n.set(1,1,1),t.identity(),this;let a=Ei.set(i[0],i[1],i[2]).length();const o=Ei.set(i[4],i[5],i[6]).length(),l=Ei.set(i[8],i[9],i[10]).length();s<0&&(a=-a),$t.copy(this);const c=1/a,u=1/o,h=1/l;return $t.elements[0]*=c,$t.elements[1]*=c,$t.elements[2]*=c,$t.elements[4]*=u,$t.elements[5]*=u,$t.elements[6]*=u,$t.elements[8]*=h,$t.elements[9]*=h,$t.elements[10]*=h,t.setFromRotationMatrix($t),n.x=a,n.y=o,n.z=l,this}makePerspective(e,t,n,i,s,a,o=mn,l=!1){const c=this.elements,u=2*s/(t-e),h=2*s/(n-i),d=(t+e)/(t-e),f=(n+i)/(n-i);let _,g;if(l)_=s/(a-s),g=a*s/(a-s);else if(o===mn)_=-(a+s)/(a-s),g=-2*a*s/(a-s);else if(o===Cr)_=-a/(a-s),g=-a*s/(a-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=u,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=h,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=_,c[14]=g,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,i,s,a,o=mn,l=!1){const c=this.elements,u=2/(t-e),h=2/(n-i),d=-(t+e)/(t-e),f=-(n+i)/(n-i);let _,g;if(l)_=1/(a-s),g=a/(a-s);else if(o===mn)_=-2/(a-s),g=-(a+s)/(a-s);else if(o===Cr)_=-1/(a-s),g=-s/(a-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=u,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=h,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=_,c[14]=g,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){const t=this.elements,n=e.elements;for(let i=0;i<16;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}}const Ei=new I,$t=new Ne,mh=new I(0,0,0),_h=new I(1,1,1),Kn=new I,Fr=new I,Gt=new I,Pl=new Ne,Il=new vn;class an{constructor(e=0,t=0,n=0,i=an.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,i=this._order){return this._x=e,this._y=t,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){const i=e.elements,s=i[0],a=i[4],o=i[8],l=i[1],c=i[5],u=i[9],h=i[2],d=i[6],f=i[10];switch(t){case"XYZ":this._y=Math.asin(Ge(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-u,f),this._z=Math.atan2(-a,s)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Ge(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-h,s),this._z=0);break;case"ZXY":this._x=Math.asin(Ge(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-h,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-Ge(h,-1,1)),Math.abs(h)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(Ge(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-u,c),this._y=Math.atan2(-h,s)):(this._x=0,this._y=Math.atan2(o,f));break;case"XZY":this._z=Math.asin(-Ge(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,s)):(this._x=Math.atan2(-u,f),this._y=0);break;default:ye("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Pl.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Pl,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Il.setFromEuler(this),this.setFromQuaternion(Il,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}an.DEFAULT_ORDER="XYZ";class jo{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let gh=0;const Nl=new I,yi=new vn,An=new Ne,Br=new I,ir=new I,Mh=new I,xh=new vn,Ol=new I(1,0,0),Dl=new I(0,1,0),Ul=new I(0,0,1),Fl={type:"added"},Sh={type:"removed"},bi={type:"childadded",child:null},Qs={type:"childremoved",child:null};class ut extends _i{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:gh++}),this.uuid=sn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=ut.DEFAULT_UP.clone();const e=new I,t=new an,n=new vn,i=new I(1,1,1);function s(){n.setFromEuler(t,!1)}function a(){t.setFromQuaternion(n,void 0,!1)}t._onChange(s),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new Ne},normalMatrix:{value:new Ue}}),this.matrix=new Ne,this.matrixWorld=new Ne,this.matrixAutoUpdate=ut.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=ut.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new jo,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return yi.setFromAxisAngle(e,t),this.quaternion.multiply(yi),this}rotateOnWorldAxis(e,t){return yi.setFromAxisAngle(e,t),this.quaternion.premultiply(yi),this}rotateX(e){return this.rotateOnAxis(Ol,e)}rotateY(e){return this.rotateOnAxis(Dl,e)}rotateZ(e){return this.rotateOnAxis(Ul,e)}translateOnAxis(e,t){return Nl.copy(e).applyQuaternion(this.quaternion),this.position.add(Nl.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Ol,e)}translateY(e){return this.translateOnAxis(Dl,e)}translateZ(e){return this.translateOnAxis(Ul,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(An.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?Br.copy(e):Br.set(e,t,n);const i=this.parent;this.updateWorldMatrix(!0,!1),ir.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?An.lookAt(ir,Br,this.up):An.lookAt(Br,ir,this.up),this.quaternion.setFromRotationMatrix(An),i&&(An.extractRotation(i.matrixWorld),yi.setFromRotationMatrix(An),this.quaternion.premultiply(yi.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Te("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Fl),bi.child=e,this.dispatchEvent(bi),bi.child=null):Te("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Sh),Qs.child=e,this.dispatchEvent(Qs),Qs.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),An.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),An.multiply(e.parent.matrixWorld)),e.applyMatrix4(An),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Fl),bi.child=e,this.dispatchEvent(bi),bi.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,i=this.children.length;n<i;n++){const a=this.children[n].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);const i=this.children;for(let s=0,a=i.length;s<a;s++)i[s].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ir,e,Mh),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ir,xh,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);const e=this.pivot;if(e!==null){const t=e.x,n=e.y,i=e.z,s=this.matrix.elements;s[12]+=t-s[0]*t-s[4]*n-s[8]*i,s[13]+=n-s[1]*t-s[5]*n-s[9]*i,s[14]+=i-s[2]*t-s[6]*n-s[10]*i}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t){const n=this.parent;if(e===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){const i=this.children;for(let s=0,a=i.length;s<a;s++)i[s].updateWorldMatrix(!1,!0)}}toJSON(e){const t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),this.static!==!1&&(i.static=this.static),Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.pivot!==null&&(i.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(i.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(i.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),i.instanceInfo=this._instanceInfo.map(o=>({...o})),i.availableInstanceIds=this._availableInstanceIds.slice(),i.availableGeometryIds=this._availableGeometryIds.slice(),i.nextIndexStart=this._nextIndexStart,i.nextVertexStart=this._nextVertexStart,i.geometryCount=this._geometryCount,i.maxInstanceCount=this._maxInstanceCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.matricesTexture=this._matricesTexture.toJSON(e),i.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(i.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(i.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(i.boundingBox=this.boundingBox.toJSON()));function s(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=s(e.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,u=l.length;c<u;c++){const h=l[c];s(e.shapes,h)}else s(e.shapes,l)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(s(e.materials,this.material[l]));i.material=o}else i.material=s(e.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];i.animations.push(s(e.animations,l))}}if(t){const o=a(e.geometries),l=a(e.materials),c=a(e.textures),u=a(e.images),h=a(e.shapes),d=a(e.skeletons),f=a(e.animations),_=a(e.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),u.length>0&&(n.images=u),h.length>0&&(n.shapes=h),d.length>0&&(n.skeletons=d),f.length>0&&(n.animations=f),_.length>0&&(n.nodes=_)}return n.object=i,n;function a(o){const l=[];for(const c in o){const u=o[c];delete u.metadata,l.push(u)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),e.pivot!==null&&(this.pivot=e.pivot.clone()),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){const i=e.children[n];this.add(i.clone())}return this}}ut.DEFAULT_UP=new I(0,1,0);ut.DEFAULT_MATRIX_AUTO_UPDATE=!0;ut.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;class _n extends ut{constructor(){super(),this.isGroup=!0,this.type="Group"}}const vh={type:"move"};class Ys{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new _n,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new _n,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new I,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new I),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new _n,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new I,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new I),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let i=null,s=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(const g of e.hand.values()){const m=t.getJointPose(g,n),p=this._getHandJoint(c,g);m!==null&&(p.matrix.fromArray(m.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=m.radius),p.visible=m!==null}const u=c.joints["index-finger-tip"],h=c.joints["thumb-tip"],d=u.position.distanceTo(h.position),f=.02,_=.005;c.inputState.pinching&&d>f+_?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&d<=f-_&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,n),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(i=t.getPose(e.targetRaySpace,n),i===null&&s!==null&&(i=s),i!==null&&(o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,i.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(i.linearVelocity)):o.hasLinearVelocity=!1,i.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(i.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(vh)))}return o!==null&&(o.visible=i!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const n=new _n;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}const Eu={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},qn={h:0,s:0,l:0},kr={h:0,s:0,l:0};function Zs(r,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?r+(e-r)*6*t:t<1/2?e:t<2/3?r+(e-r)*6*(2/3-t):r}class Le{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){const i=e;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=dt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Xe.colorSpaceToWorking(this,t),this}setRGB(e,t,n,i=Xe.workingColorSpace){return this.r=e,this.g=t,this.b=n,Xe.colorSpaceToWorking(this,i),this}setHSL(e,t,n,i=Xe.workingColorSpace){if(e=Ko(e,1),t=Ge(t,0,1),n=Ge(n,0,1),t===0)this.r=this.g=this.b=n;else{const s=n<=.5?n*(1+t):n+t-n*t,a=2*n-s;this.r=Zs(a,s,e+1/3),this.g=Zs(a,s,e),this.b=Zs(a,s,e-1/3)}return Xe.colorSpaceToWorking(this,i),this}setStyle(e,t=dt){function n(s){s!==void 0&&parseFloat(s)<1&&ye("Color: Alpha component of "+e+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(e)){let s;const a=i[1],o=i[2];switch(a){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,t);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,t);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,t);break;default:ye("Color: Unknown color model "+e)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(e)){const s=i[1],a=s.length;if(a===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(s,16),t);ye("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=dt){const n=Eu[e.toLowerCase()];return n!==void 0?this.setHex(n,t):ye("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=kn(e.r),this.g=kn(e.g),this.b=kn(e.b),this}copyLinearToSRGB(e){return this.r=Hi(e.r),this.g=Hi(e.g),this.b=Hi(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=dt){return Xe.workingToColorSpace(Ot.copy(this),e),Math.round(Ge(Ot.r*255,0,255))*65536+Math.round(Ge(Ot.g*255,0,255))*256+Math.round(Ge(Ot.b*255,0,255))}getHexString(e=dt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Xe.workingColorSpace){Xe.workingToColorSpace(Ot.copy(this),t);const n=Ot.r,i=Ot.g,s=Ot.b,a=Math.max(n,i,s),o=Math.min(n,i,s);let l,c;const u=(o+a)/2;if(o===a)l=0,c=0;else{const h=a-o;switch(c=u<=.5?h/(a+o):h/(2-a-o),a){case n:l=(i-s)/h+(i<s?6:0);break;case i:l=(s-n)/h+2;break;case s:l=(n-i)/h+4;break}l/=6}return e.h=l,e.s=c,e.l=u,e}getRGB(e,t=Xe.workingColorSpace){return Xe.workingToColorSpace(Ot.copy(this),t),e.r=Ot.r,e.g=Ot.g,e.b=Ot.b,e}getStyle(e=dt){Xe.workingToColorSpace(Ot.copy(this),e);const t=Ot.r,n=Ot.g,i=Ot.b;return e!==dt?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(e,t,n){return this.getHSL(qn),this.setHSL(qn.h+e,qn.s+t,qn.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(qn),e.getHSL(kr);const n=vr(qn.h,kr.h,t),i=vr(qn.s,kr.s,t),s=vr(qn.l,kr.l,t);return this.setHSL(n,i,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,n=this.g,i=this.b,s=e.elements;return this.r=s[0]*t+s[3]*n+s[6]*i,this.g=s[1]*t+s[4]*n+s[7]*i,this.b=s[2]*t+s[5]*n+s[8]*i,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Ot=new Le;Le.NAMES=Eu;class RM extends ut{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new an,this.environmentIntensity=1,this.environmentRotation=new an,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}}const en=new I,Tn=new I,Js=new I,Rn=new I,Ai=new I,Ti=new I,Bl=new I,$s=new I,ea=new I,ta=new I,na=new lt,ia=new lt,ra=new lt;class jt{constructor(e=new I,t=new I,n=new I){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,i){i.subVectors(n,t),en.subVectors(e,t),i.cross(en);const s=i.lengthSq();return s>0?i.multiplyScalar(1/Math.sqrt(s)):i.set(0,0,0)}static getBarycoord(e,t,n,i,s){en.subVectors(i,t),Tn.subVectors(n,t),Js.subVectors(e,t);const a=en.dot(en),o=en.dot(Tn),l=en.dot(Js),c=Tn.dot(Tn),u=Tn.dot(Js),h=a*c-o*o;if(h===0)return s.set(0,0,0),null;const d=1/h,f=(c*l-o*u)*d,_=(a*u-o*l)*d;return s.set(1-f-_,_,f)}static containsPoint(e,t,n,i){return this.getBarycoord(e,t,n,i,Rn)===null?!1:Rn.x>=0&&Rn.y>=0&&Rn.x+Rn.y<=1}static getInterpolation(e,t,n,i,s,a,o,l){return this.getBarycoord(e,t,n,i,Rn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,Rn.x),l.addScaledVector(a,Rn.y),l.addScaledVector(o,Rn.z),l)}static getInterpolatedAttribute(e,t,n,i,s,a){return na.setScalar(0),ia.setScalar(0),ra.setScalar(0),na.fromBufferAttribute(e,t),ia.fromBufferAttribute(e,n),ra.fromBufferAttribute(e,i),a.setScalar(0),a.addScaledVector(na,s.x),a.addScaledVector(ia,s.y),a.addScaledVector(ra,s.z),a}static isFrontFacing(e,t,n,i){return en.subVectors(n,t),Tn.subVectors(e,t),en.cross(Tn).dot(i)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,i){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[i]),this}setFromAttributeAndIndices(e,t,n,i){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,i),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return en.subVectors(this.c,this.b),Tn.subVectors(this.a,this.b),en.cross(Tn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return jt.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return jt.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,i,s){return jt.getInterpolation(e,this.a,this.b,this.c,t,n,i,s)}containsPoint(e){return jt.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return jt.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const n=this.a,i=this.b,s=this.c;let a,o;Ai.subVectors(i,n),Ti.subVectors(s,n),$s.subVectors(e,n);const l=Ai.dot($s),c=Ti.dot($s);if(l<=0&&c<=0)return t.copy(n);ea.subVectors(e,i);const u=Ai.dot(ea),h=Ti.dot(ea);if(u>=0&&h<=u)return t.copy(i);const d=l*h-u*c;if(d<=0&&l>=0&&u<=0)return a=l/(l-u),t.copy(n).addScaledVector(Ai,a);ta.subVectors(e,s);const f=Ai.dot(ta),_=Ti.dot(ta);if(_>=0&&f<=_)return t.copy(s);const g=f*c-l*_;if(g<=0&&c>=0&&_<=0)return o=c/(c-_),t.copy(n).addScaledVector(Ti,o);const m=u*_-f*h;if(m<=0&&h-u>=0&&f-_>=0)return Bl.subVectors(s,i),o=(h-u)/(h-u+(f-_)),t.copy(i).addScaledVector(Bl,o);const p=1/(m+g+d);return a=g*p,o=d*p,t.copy(n).addScaledVector(Ai,a).addScaledVector(Ti,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}class Vn{constructor(e=new I(1/0,1/0,1/0),t=new I(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(tn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(tn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const n=tn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const n=e.geometry;if(n!==void 0){const s=n.getAttribute("position");if(t===!0&&s!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=s.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,tn):tn.fromBufferAttribute(s,a),tn.applyMatrix4(e.matrixWorld),this.expandByPoint(tn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),zr.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),zr.copy(n.boundingBox)),zr.applyMatrix4(e.matrixWorld),this.union(zr)}const i=e.children;for(let s=0,a=i.length;s<a;s++)this.expandByObject(i[s],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,tn),tn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(rr),Hr.subVectors(this.max,rr),Ri.subVectors(e.a,rr),Ci.subVectors(e.b,rr),Li.subVectors(e.c,rr),jn.subVectors(Ci,Ri),Qn.subVectors(Li,Ci),ii.subVectors(Ri,Li);let t=[0,-jn.z,jn.y,0,-Qn.z,Qn.y,0,-ii.z,ii.y,jn.z,0,-jn.x,Qn.z,0,-Qn.x,ii.z,0,-ii.x,-jn.y,jn.x,0,-Qn.y,Qn.x,0,-ii.y,ii.x,0];return!sa(t,Ri,Ci,Li,Hr)||(t=[1,0,0,0,1,0,0,0,1],!sa(t,Ri,Ci,Li,Hr))?!1:(Gr.crossVectors(jn,Qn),t=[Gr.x,Gr.y,Gr.z],sa(t,Ri,Ci,Li,Hr))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,tn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(tn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Cn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Cn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Cn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Cn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Cn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Cn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Cn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Cn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Cn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}const Cn=[new I,new I,new I,new I,new I,new I,new I,new I],tn=new I,zr=new Vn,Ri=new I,Ci=new I,Li=new I,jn=new I,Qn=new I,ii=new I,rr=new I,Hr=new I,Gr=new I,ri=new I;function sa(r,e,t,n,i){for(let s=0,a=r.length-3;s<=a;s+=3){ri.fromArray(r,s);const o=i.x*Math.abs(ri.x)+i.y*Math.abs(ri.y)+i.z*Math.abs(ri.z),l=e.dot(ri),c=t.dot(ri),u=n.dot(ri);if(Math.max(-Math.max(l,c,u),Math.min(l,c,u))>o)return!1}return!0}const Mt=new I,Vr=new Ie;let Eh=0;class Lt{constructor(e,t,n=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Eh++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=Eo,this.updateRanges=[],this.gpuType=Qt,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let i=0,s=this.itemSize;i<s;i++)this.array[e+i]=t.array[n+i];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Vr.fromBufferAttribute(this,t),Vr.applyMatrix3(e),this.setXY(t,Vr.x,Vr.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Mt.fromBufferAttribute(this,t),Mt.applyMatrix3(e),this.setXYZ(t,Mt.x,Mt.y,Mt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Mt.fromBufferAttribute(this,t),Mt.applyMatrix4(e),this.setXYZ(t,Mt.x,Mt.y,Mt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Mt.fromBufferAttribute(this,t),Mt.applyNormalMatrix(e),this.setXYZ(t,Mt.x,Mt.y,Mt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Mt.fromBufferAttribute(this,t),Mt.transformDirection(e),this.setXYZ(t,Mt.x,Mt.y,Mt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=rn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Je(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=rn(t,this.array)),t}setX(e,t){return this.normalized&&(t=Je(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=rn(t,this.array)),t}setY(e,t){return this.normalized&&(t=Je(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=rn(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Je(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=rn(t,this.array)),t}setW(e,t){return this.normalized&&(t=Je(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=Je(t,this.array),n=Je(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,i){return e*=this.itemSize,this.normalized&&(t=Je(t,this.array),n=Je(n,this.array),i=Je(i,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this}setXYZW(e,t,n,i,s){return e*=this.itemSize,this.normalized&&(t=Je(t,this.array),n=Je(n,this.array),i=Je(i,this.array),s=Je(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Eo&&(e.usage=this.usage),e}}class yu extends Lt{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class bu extends Lt{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class mt extends Lt{constructor(e,t,n){super(new Float32Array(e),t,n)}}const yh=new Vn,sr=new I,aa=new I;class on{constructor(e=new I,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const n=this.center;t!==void 0?n.copy(t):yh.setFromPoints(e).getCenter(n);let i=0;for(let s=0,a=e.length;s<a;s++)i=Math.max(i,n.distanceToSquared(e[s]));return this.radius=Math.sqrt(i),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;sr.subVectors(e,this.center);const t=sr.lengthSq();if(t>this.radius*this.radius){const n=Math.sqrt(t),i=(n-this.radius)*.5;this.center.addScaledVector(sr,i/n),this.radius+=i}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(aa.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(sr.copy(e.center).add(aa)),this.expandByPoint(sr.copy(e.center).sub(aa))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}let bh=0;const Kt=new Ne,oa=new ut,wi=new I,Vt=new Vn,ar=new Vn,Rt=new I;class Pt extends _i{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:bh++}),this.uuid=sn(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Hd(e)?bu:yu)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const s=new Ue().getNormalMatrix(e);n.applyNormalMatrix(s),n.needsUpdate=!0}const i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(e),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return Kt.makeRotationFromQuaternion(e),this.applyMatrix4(Kt),this}rotateX(e){return Kt.makeRotationX(e),this.applyMatrix4(Kt),this}rotateY(e){return Kt.makeRotationY(e),this.applyMatrix4(Kt),this}rotateZ(e){return Kt.makeRotationZ(e),this.applyMatrix4(Kt),this}translate(e,t,n){return Kt.makeTranslation(e,t,n),this.applyMatrix4(Kt),this}scale(e,t,n){return Kt.makeScale(e,t,n),this.applyMatrix4(Kt),this}lookAt(e){return oa.lookAt(e),oa.updateMatrix(),this.applyMatrix4(oa.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(wi).negate(),this.translate(wi.x,wi.y,wi.z),this}setFromPoints(e){const t=this.getAttribute("position");if(t===void 0){const n=[];for(let i=0,s=e.length;i<s;i++){const a=e[i];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new mt(n,3))}else{const n=Math.min(e.length,t.count);for(let i=0;i<n;i++){const s=e[i];t.setXYZ(i,s.x,s.y,s.z||0)}e.length>t.count&&ye("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Vn);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Te("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new I(-1/0,-1/0,-1/0),new I(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,i=t.length;n<i;n++){const s=t[n];Vt.setFromBufferAttribute(s),this.morphTargetsRelative?(Rt.addVectors(this.boundingBox.min,Vt.min),this.boundingBox.expandByPoint(Rt),Rt.addVectors(this.boundingBox.max,Vt.max),this.boundingBox.expandByPoint(Rt)):(this.boundingBox.expandByPoint(Vt.min),this.boundingBox.expandByPoint(Vt.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Te('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new on);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Te("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new I,1/0);return}if(e){const n=this.boundingSphere.center;if(Vt.setFromBufferAttribute(e),t)for(let s=0,a=t.length;s<a;s++){const o=t[s];ar.setFromBufferAttribute(o),this.morphTargetsRelative?(Rt.addVectors(Vt.min,ar.min),Vt.expandByPoint(Rt),Rt.addVectors(Vt.max,ar.max),Vt.expandByPoint(Rt)):(Vt.expandByPoint(ar.min),Vt.expandByPoint(ar.max))}Vt.getCenter(n);let i=0;for(let s=0,a=e.count;s<a;s++)Rt.fromBufferAttribute(e,s),i=Math.max(i,n.distanceToSquared(Rt));if(t)for(let s=0,a=t.length;s<a;s++){const o=t[s],l=this.morphTargetsRelative;for(let c=0,u=o.count;c<u;c++)Rt.fromBufferAttribute(o,c),l&&(wi.fromBufferAttribute(e,c),Rt.add(wi)),i=Math.max(i,n.distanceToSquared(Rt))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&Te('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Te("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=t.position,i=t.normal,s=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Lt(new Float32Array(4*n.count),4));const a=this.getAttribute("tangent"),o=[],l=[];for(let x=0;x<n.count;x++)o[x]=new I,l[x]=new I;const c=new I,u=new I,h=new I,d=new Ie,f=new Ie,_=new Ie,g=new I,m=new I;function p(x,b,V){c.fromBufferAttribute(n,x),u.fromBufferAttribute(n,b),h.fromBufferAttribute(n,V),d.fromBufferAttribute(s,x),f.fromBufferAttribute(s,b),_.fromBufferAttribute(s,V),u.sub(c),h.sub(c),f.sub(d),_.sub(d);const C=1/(f.x*_.y-_.x*f.y);isFinite(C)&&(g.copy(u).multiplyScalar(_.y).addScaledVector(h,-f.y).multiplyScalar(C),m.copy(h).multiplyScalar(f.x).addScaledVector(u,-_.x).multiplyScalar(C),o[x].add(g),o[b].add(g),o[V].add(g),l[x].add(m),l[b].add(m),l[V].add(m))}let v=this.groups;v.length===0&&(v=[{start:0,count:e.count}]);for(let x=0,b=v.length;x<b;++x){const V=v[x],C=V.start,D=V.count;for(let U=C,H=C+D;U<H;U+=3)p(e.getX(U+0),e.getX(U+1),e.getX(U+2))}const y=new I,E=new I,R=new I,T=new I;function L(x){R.fromBufferAttribute(i,x),T.copy(R);const b=o[x];y.copy(b),y.sub(R.multiplyScalar(R.dot(b))).normalize(),E.crossVectors(T,b);const C=E.dot(l[x])<0?-1:1;a.setXYZW(x,y.x,y.y,y.z,C)}for(let x=0,b=v.length;x<b;++x){const V=v[x],C=V.start,D=V.count;for(let U=C,H=C+D;U<H;U+=3)L(e.getX(U+0)),L(e.getX(U+1)),L(e.getX(U+2))}}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new Lt(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let d=0,f=n.count;d<f;d++)n.setXYZ(d,0,0,0);const i=new I,s=new I,a=new I,o=new I,l=new I,c=new I,u=new I,h=new I;if(e)for(let d=0,f=e.count;d<f;d+=3){const _=e.getX(d+0),g=e.getX(d+1),m=e.getX(d+2);i.fromBufferAttribute(t,_),s.fromBufferAttribute(t,g),a.fromBufferAttribute(t,m),u.subVectors(a,s),h.subVectors(i,s),u.cross(h),o.fromBufferAttribute(n,_),l.fromBufferAttribute(n,g),c.fromBufferAttribute(n,m),o.add(u),l.add(u),c.add(u),n.setXYZ(_,o.x,o.y,o.z),n.setXYZ(g,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,f=t.count;d<f;d+=3)i.fromBufferAttribute(t,d+0),s.fromBufferAttribute(t,d+1),a.fromBufferAttribute(t,d+2),u.subVectors(a,s),h.subVectors(i,s),u.cross(h),n.setXYZ(d+0,u.x,u.y,u.z),n.setXYZ(d+1,u.x,u.y,u.z),n.setXYZ(d+2,u.x,u.y,u.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Rt.fromBufferAttribute(e,t),Rt.normalize(),e.setXYZ(t,Rt.x,Rt.y,Rt.z)}toNonIndexed(){function e(o,l){const c=o.array,u=o.itemSize,h=o.normalized,d=new c.constructor(l.length*u);let f=0,_=0;for(let g=0,m=l.length;g<m;g++){o.isInterleavedBufferAttribute?f=l[g]*o.data.stride+o.offset:f=l[g]*u;for(let p=0;p<u;p++)d[_++]=c[f++]}return new Lt(d,u,h)}if(this.index===null)return ye("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new Pt,n=this.index.array,i=this.attributes;for(const o in i){const l=i[o],c=e(l,n);t.setAttribute(o,c)}const s=this.morphAttributes;for(const o in s){const l=[],c=s[o];for(let u=0,h=c.length;u<h;u++){const d=c[u],f=e(d,n);l.push(f)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const n=this.attributes;for(const l in n){const c=n[l];e.data.attributes[l]=c.toJSON(e.data)}const i={};let s=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],u=[];for(let h=0,d=c.length;h<d;h++){const f=c[h];u.push(f.toJSON(e.data))}u.length>0&&(i[l]=u,s=!0)}s&&(e.data.morphAttributes=i,e.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const n=e.index;n!==null&&this.setIndex(n.clone());const i=e.attributes;for(const c in i){const u=i[c];this.setAttribute(c,u.clone(t))}const s=e.morphAttributes;for(const c in s){const u=[],h=s[c];for(let d=0,f=h.length;d<f;d++)u.push(h[d].clone(t));this.morphAttributes[c]=u}this.morphTargetsRelative=e.morphTargetsRelative;const a=e.groups;for(let c=0,u=a.length;c<u;c++){const h=a[c];this.addGroup(h.start,h.count,h.materialIndex)}const o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Qo{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=Eo,this.updateRanges=[],this.version=0,this.uuid=sn()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let i=0,s=this.stride;i<s;i++)this.array[e+i]=t.array[n+i];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=sn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=sn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const Ut=new I;class ji{constructor(e,t,n,i=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=i}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)Ut.fromBufferAttribute(this,t),Ut.applyMatrix4(e),this.setXYZ(t,Ut.x,Ut.y,Ut.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Ut.fromBufferAttribute(this,t),Ut.applyNormalMatrix(e),this.setXYZ(t,Ut.x,Ut.y,Ut.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Ut.fromBufferAttribute(this,t),Ut.transformDirection(e),this.setXYZ(t,Ut.x,Ut.y,Ut.z);return this}getComponent(e,t){let n=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(n=rn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Je(n,this.array)),this.data.array[e*this.data.stride+this.offset+t]=n,this}setX(e,t){return this.normalized&&(t=Je(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=Je(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=Je(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=Je(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=rn(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=rn(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=rn(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=rn(t,this.array)),t}setXY(e,t,n){return e=e*this.data.stride+this.offset,this.normalized&&(t=Je(t,this.array),n=Je(n,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,i){return e=e*this.data.stride+this.offset,this.normalized&&(t=Je(t,this.array),n=Je(n,this.array),i=Je(i,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this}setXYZW(e,t,n,i,s){return e=e*this.data.stride+this.offset,this.normalized&&(t=Je(t,this.array),n=Je(n,this.array),i=Je(i,this.array),s=Je(s,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this.data.array[e+3]=s,this}clone(e){if(e===void 0){ys("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let n=0;n<this.count;n++){const i=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[i+s])}return new Lt(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new ji(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){ys("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let n=0;n<this.count;n++){const i=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[i+s])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}let Ah=0;class Zt extends _i{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Ah++}),this.uuid=sn(),this.name="",this.type="Material",this.blending=zi,this.side=zn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Na,this.blendDst=Oa,this.blendEquation=hi,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Le(0,0,0),this.blendAlpha=0,this.depthFunc=Vi,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=bl,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Si,this.stencilZFail=Si,this.stencilZPass=Si,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const n=e[t];if(n===void 0){ye(`Material: parameter '${t}' has value of undefined.`);continue}const i=this[t];if(i===void 0){ye(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}i&&i.isColor?i.set(n):i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==zi&&(n.blending=this.blending),this.side!==zn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==Na&&(n.blendSrc=this.blendSrc),this.blendDst!==Oa&&(n.blendDst=this.blendDst),this.blendEquation!==hi&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Vi&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==bl&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Si&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Si&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Si&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.allowOverride===!1&&(n.allowOverride=!1),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(s){const a=[];for(const o in s){const l=s[o];delete l.metadata,a.push(l)}return a}if(t){const s=i(e.textures),a=i(e.images);s.length>0&&(n.textures=s),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let n=null;if(t!==null){const i=t.length;n=new Array(i);for(let s=0;s!==i;++s)n[s]=t[s].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}class Th extends Zt{constructor(e){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new Le(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}let Pi;const or=new I,Ii=new I,Ni=new I,Oi=new Ie,lr=new Ie,Au=new Ne,Wr=new I,cr=new I,Xr=new I,kl=new Ie,la=new Ie,zl=new Ie;class CM extends ut{constructor(e=new Th){if(super(),this.isSprite=!0,this.type="Sprite",Pi===void 0){Pi=new Pt;const t=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new Qo(t,5);Pi.setIndex([0,1,2,0,2,3]),Pi.setAttribute("position",new ji(n,3,0,!1)),Pi.setAttribute("uv",new ji(n,2,3,!1))}this.geometry=Pi,this.material=e,this.center=new Ie(.5,.5),this.count=1}raycast(e,t){e.camera===null&&Te('Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),Ii.setFromMatrixScale(this.matrixWorld),Au.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),Ni.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&Ii.multiplyScalar(-Ni.z);const n=this.material.rotation;let i,s;n!==0&&(s=Math.cos(n),i=Math.sin(n));const a=this.center;Kr(Wr.set(-.5,-.5,0),Ni,a,Ii,i,s),Kr(cr.set(.5,-.5,0),Ni,a,Ii,i,s),Kr(Xr.set(.5,.5,0),Ni,a,Ii,i,s),kl.set(0,0),la.set(1,0),zl.set(1,1);let o=e.ray.intersectTriangle(Wr,cr,Xr,!1,or);if(o===null&&(Kr(cr.set(-.5,.5,0),Ni,a,Ii,i,s),la.set(0,1),o=e.ray.intersectTriangle(Wr,Xr,cr,!1,or),o===null))return;const l=e.ray.origin.distanceTo(or);l<e.near||l>e.far||t.push({distance:l,point:or.clone(),uv:jt.getInterpolation(or,Wr,cr,Xr,kl,la,zl,new Ie),face:null,object:this})}copy(e,t){return super.copy(e,t),e.center!==void 0&&this.center.copy(e.center),this.material=e.material,this}}function Kr(r,e,t,n,i,s){Oi.subVectors(r,t).addScalar(.5).multiply(n),i!==void 0?(lr.x=s*Oi.x-i*Oi.y,lr.y=i*Oi.x+s*Oi.y):lr.copy(Oi),r.copy(e),r.x+=lr.x,r.y+=lr.y,r.applyMatrix4(Au)}const Ln=new I,ca=new I,qr=new I,Yn=new I,ua=new I,jr=new I,da=new I;class Ir{constructor(e=new I,t=new I(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Ln)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=Ln.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Ln.copy(this.origin).addScaledVector(this.direction,t),Ln.distanceToSquared(e))}distanceSqToSegment(e,t,n,i){ca.copy(e).add(t).multiplyScalar(.5),qr.copy(t).sub(e).normalize(),Yn.copy(this.origin).sub(ca);const s=e.distanceTo(t)*.5,a=-this.direction.dot(qr),o=Yn.dot(this.direction),l=-Yn.dot(qr),c=Yn.lengthSq(),u=Math.abs(1-a*a);let h,d,f,_;if(u>0)if(h=a*l-o,d=a*o-l,_=s*u,h>=0)if(d>=-_)if(d<=_){const g=1/u;h*=g,d*=g,f=h*(h+a*d+2*o)+d*(a*h+d+2*l)+c}else d=s,h=Math.max(0,-(a*d+o)),f=-h*h+d*(d+2*l)+c;else d=-s,h=Math.max(0,-(a*d+o)),f=-h*h+d*(d+2*l)+c;else d<=-_?(h=Math.max(0,-(-a*s+o)),d=h>0?-s:Math.min(Math.max(-s,-l),s),f=-h*h+d*(d+2*l)+c):d<=_?(h=0,d=Math.min(Math.max(-s,-l),s),f=d*(d+2*l)+c):(h=Math.max(0,-(a*s+o)),d=h>0?s:Math.min(Math.max(-s,-l),s),f=-h*h+d*(d+2*l)+c);else d=a>0?-s:s,h=Math.max(0,-(a*d+o)),f=-h*h+d*(d+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,h),i&&i.copy(ca).addScaledVector(qr,d),f}intersectSphere(e,t){Ln.subVectors(e.center,this.origin);const n=Ln.dot(this.direction),i=Ln.dot(Ln)-n*n,s=e.radius*e.radius;if(i>s)return null;const a=Math.sqrt(s-i),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){const n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,i,s,a,o,l;const c=1/this.direction.x,u=1/this.direction.y,h=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,i=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,i=(e.min.x-d.x)*c),u>=0?(s=(e.min.y-d.y)*u,a=(e.max.y-d.y)*u):(s=(e.max.y-d.y)*u,a=(e.min.y-d.y)*u),n>a||s>i||((s>n||isNaN(n))&&(n=s),(a<i||isNaN(i))&&(i=a),h>=0?(o=(e.min.z-d.z)*h,l=(e.max.z-d.z)*h):(o=(e.max.z-d.z)*h,l=(e.min.z-d.z)*h),n>l||o>i)||((o>n||n!==n)&&(n=o),(l<i||i!==i)&&(i=l),i<0)?null:this.at(n>=0?n:i,t)}intersectsBox(e){return this.intersectBox(e,Ln)!==null}intersectTriangle(e,t,n,i,s){ua.subVectors(t,e),jr.subVectors(n,e),da.crossVectors(ua,jr);let a=this.direction.dot(da),o;if(a>0){if(i)return null;o=1}else if(a<0)o=-1,a=-a;else return null;Yn.subVectors(this.origin,e);const l=o*this.direction.dot(jr.crossVectors(Yn,jr));if(l<0)return null;const c=o*this.direction.dot(ua.cross(Yn));if(c<0||l+c>a)return null;const u=-o*Yn.dot(da);return u<0?null:this.at(u/a,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Dn extends Zt{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Le(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new an,this.combine=Do,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const Hl=new Ne,si=new Ir,Qr=new on,Gl=new I,Yr=new I,Zr=new I,Jr=new I,ha=new I,$r=new I,Vl=new I,es=new I;class wt extends ut{constructor(e=new Pt,t=new Dn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=i.length;s<a;s++){const o=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}getVertexPosition(e,t){const n=this.geometry,i=n.attributes.position,s=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(i,e);const o=this.morphTargetInfluences;if(s&&o){$r.set(0,0,0);for(let l=0,c=s.length;l<c;l++){const u=o[l],h=s[l];u!==0&&(ha.fromBufferAttribute(h,e),a?$r.addScaledVector(ha,u):$r.addScaledVector(ha.sub(t),u))}t.add($r)}return t}raycast(e,t){const n=this.geometry,i=this.material,s=this.matrixWorld;i!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Qr.copy(n.boundingSphere),Qr.applyMatrix4(s),si.copy(e.ray).recast(e.near),!(Qr.containsPoint(si.origin)===!1&&(si.intersectSphere(Qr,Gl)===null||si.origin.distanceToSquared(Gl)>(e.far-e.near)**2))&&(Hl.copy(s).invert(),si.copy(e.ray).applyMatrix4(Hl),!(n.boundingBox!==null&&si.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,si)))}_computeIntersections(e,t,n){let i;const s=this.geometry,a=this.material,o=s.index,l=s.attributes.position,c=s.attributes.uv,u=s.attributes.uv1,h=s.attributes.normal,d=s.groups,f=s.drawRange;if(o!==null)if(Array.isArray(a))for(let _=0,g=d.length;_<g;_++){const m=d[_],p=a[m.materialIndex],v=Math.max(m.start,f.start),y=Math.min(o.count,Math.min(m.start+m.count,f.start+f.count));for(let E=v,R=y;E<R;E+=3){const T=o.getX(E),L=o.getX(E+1),x=o.getX(E+2);i=ts(this,p,e,n,c,u,h,T,L,x),i&&(i.faceIndex=Math.floor(E/3),i.face.materialIndex=m.materialIndex,t.push(i))}}else{const _=Math.max(0,f.start),g=Math.min(o.count,f.start+f.count);for(let m=_,p=g;m<p;m+=3){const v=o.getX(m),y=o.getX(m+1),E=o.getX(m+2);i=ts(this,a,e,n,c,u,h,v,y,E),i&&(i.faceIndex=Math.floor(m/3),t.push(i))}}else if(l!==void 0)if(Array.isArray(a))for(let _=0,g=d.length;_<g;_++){const m=d[_],p=a[m.materialIndex],v=Math.max(m.start,f.start),y=Math.min(l.count,Math.min(m.start+m.count,f.start+f.count));for(let E=v,R=y;E<R;E+=3){const T=E,L=E+1,x=E+2;i=ts(this,p,e,n,c,u,h,T,L,x),i&&(i.faceIndex=Math.floor(E/3),i.face.materialIndex=m.materialIndex,t.push(i))}}else{const _=Math.max(0,f.start),g=Math.min(l.count,f.start+f.count);for(let m=_,p=g;m<p;m+=3){const v=m,y=m+1,E=m+2;i=ts(this,a,e,n,c,u,h,v,y,E),i&&(i.faceIndex=Math.floor(m/3),t.push(i))}}}}function Rh(r,e,t,n,i,s,a,o){let l;if(e.side===zt?l=n.intersectTriangle(a,s,i,!0,o):l=n.intersectTriangle(i,s,a,e.side===zn,o),l===null)return null;es.copy(o),es.applyMatrix4(r.matrixWorld);const c=t.ray.origin.distanceTo(es);return c<t.near||c>t.far?null:{distance:c,point:es.clone(),object:r}}function ts(r,e,t,n,i,s,a,o,l,c){r.getVertexPosition(o,Yr),r.getVertexPosition(l,Zr),r.getVertexPosition(c,Jr);const u=Rh(r,e,t,n,Yr,Zr,Jr,Vl);if(u){const h=new I;jt.getBarycoord(Vl,Yr,Zr,Jr,h),i&&(u.uv=jt.getInterpolatedAttribute(i,o,l,c,h,new Ie)),s&&(u.uv1=jt.getInterpolatedAttribute(s,o,l,c,h,new Ie)),a&&(u.normal=jt.getInterpolatedAttribute(a,o,l,c,h,new I),u.normal.dot(n.direction)>0&&u.normal.multiplyScalar(-1));const d={a:o,b:l,c,normal:new I,materialIndex:0};jt.getNormal(Yr,Zr,Jr,d.normal),u.face=d,u.barycoord=h}return u}const Wl=new I,Xl=new lt,Kl=new lt,Ch=new I,ql=new Ne,ns=new I,fa=new on,jl=new Ne,pa=new Ir;class Lh extends wt{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=xl,this.bindMatrix=new Ne,this.bindMatrixInverse=new Ne,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){const e=this.geometry;this.boundingBox===null&&(this.boundingBox=new Vn),this.boundingBox.makeEmpty();const t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,ns),this.boundingBox.expandByPoint(ns)}computeBoundingSphere(){const e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new on),this.boundingSphere.makeEmpty();const t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,ns),this.boundingSphere.expandByPoint(ns)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){const n=this.material,i=this.matrixWorld;n!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),fa.copy(this.boundingSphere),fa.applyMatrix4(i),e.ray.intersectsSphere(fa)!==!1&&(jl.copy(i).invert(),pa.copy(e.ray).applyMatrix4(jl),!(this.boundingBox!==null&&pa.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(e,t,pa)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){const e=new lt,t=this.geometry.attributes.skinWeight;for(let n=0,i=t.count;n<i;n++){e.fromBufferAttribute(t,n);const s=1/e.manhattanLength();s!==1/0?e.multiplyScalar(s):e.set(1,0,0,0),t.setXYZW(n,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===xl?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===wd?this.bindMatrixInverse.copy(this.bindMatrix).invert():ye("SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){const n=this.skeleton,i=this.geometry;Xl.fromBufferAttribute(i.attributes.skinIndex,e),Kl.fromBufferAttribute(i.attributes.skinWeight,e),Wl.copy(t).applyMatrix4(this.bindMatrix),t.set(0,0,0);for(let s=0;s<4;s++){const a=Kl.getComponent(s);if(a!==0){const o=Xl.getComponent(s);ql.multiplyMatrices(n.bones[o].matrixWorld,n.boneInverses[o]),t.addScaledVector(Ch.copy(Wl).applyMatrix4(ql),a)}}return t.applyMatrix4(this.bindMatrixInverse)}}class Tu extends ut{constructor(){super(),this.isBone=!0,this.type="Bone"}}class Yo extends Et{constructor(e=null,t=1,n=1,i,s,a,o,l,c=St,u=St,h,d){super(null,a,o,l,c,u,i,s,h,d),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const Ql=new Ne,wh=new Ne;class Zo{constructor(e=[],t=[]){this.uuid=sn(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.previousBoneMatrices=null,this.boneTexture=null,this.init()}init(){const e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(e.length*16),t.length===0)this.calculateInverses();else if(e.length!==t.length){ye("Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let n=0,i=this.bones.length;n<i;n++)this.boneInverses.push(new Ne)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){const n=new Ne;this.bones[e]&&n.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(n)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){const n=this.bones[e];n&&n.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){const n=this.bones[e];n&&(n.parent&&n.parent.isBone?(n.matrix.copy(n.parent.matrixWorld).invert(),n.matrix.multiply(n.matrixWorld)):n.matrix.copy(n.matrixWorld),n.matrix.decompose(n.position,n.quaternion,n.scale))}}update(){const e=this.bones,t=this.boneInverses,n=this.boneMatrices,i=this.boneTexture;for(let s=0,a=e.length;s<a;s++){const o=e[s]?e[s].matrixWorld:wh;Ql.multiplyMatrices(o,t[s]),Ql.toArray(n,s*16)}i!==null&&(i.needsUpdate=!0)}clone(){return new Zo(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(this.bones.length*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);const t=new Float32Array(e*e*4);t.set(this.boneMatrices);const n=new Yo(t,e,e,Yt,Qt);return n.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=n,this}getBoneByName(e){for(let t=0,n=this.bones.length;t<n;t++){const i=this.bones[t];if(i.name===e)return i}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let n=0,i=e.bones.length;n<i;n++){const s=e.bones[n];let a=t[s];a===void 0&&(ye("Skeleton: No bone found with UUID:",s),a=new Tu),this.bones.push(a),this.boneInverses.push(new Ne().fromArray(e.boneInverses[n]))}return this.init(),this}toJSON(){const e={metadata:{version:4.7,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;const t=this.bones,n=this.boneInverses;for(let i=0,s=t.length;i<s;i++){const a=t[i];e.bones.push(a.uuid);const o=n[i];e.boneInverses.push(o.toArray())}return e}}class yo extends Lt{constructor(e,t,n,i=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=i}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){const e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}}const Di=new Ne,Yl=new Ne,is=[],Zl=new Vn,Ph=new Ne,ur=new wt,dr=new on;class Ih extends wt{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new yo(new Float32Array(n*16),16),this.previousInstanceMatrix=null,this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let i=0;i<n;i++)this.setMatrixAt(i,Ph)}computeBoundingBox(){const e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new Vn),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Di),Zl.copy(e.boundingBox).applyMatrix4(Di),this.boundingBox.union(Zl)}computeBoundingSphere(){const e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new on),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Di),dr.copy(e.boundingSphere).applyMatrix4(Di),this.boundingSphere.union(dr)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.previousInstanceMatrix!==null&&(this.previousInstanceMatrix=e.previousInstanceMatrix.clone()),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){const n=t.morphTargetInfluences,i=this.morphTexture.source.data.data,s=n.length+1,a=e*s+1;for(let o=0;o<n.length;o++)n[o]=i[a+o]}raycast(e,t){const n=this.matrixWorld,i=this.count;if(ur.geometry=this.geometry,ur.material=this.material,ur.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),dr.copy(this.boundingSphere),dr.applyMatrix4(n),e.ray.intersectsSphere(dr)!==!1))for(let s=0;s<i;s++){this.getMatrixAt(s,Di),Yl.multiplyMatrices(n,Di),ur.matrixWorld=Yl,ur.raycast(e,is);for(let a=0,o=is.length;a<o;a++){const l=is[a];l.instanceId=s,l.object=this,t.push(l)}is.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new yo(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,e*16)}setMorphAt(e,t){const n=t.morphTargetInfluences,i=n.length+1;this.morphTexture===null&&(this.morphTexture=new Yo(new Float32Array(i*this.count),i,this.count,ko,Qt));const s=this.morphTexture.source.data.data;let a=0;for(let c=0;c<n.length;c++)a+=n[c];const o=this.geometry.morphTargetsRelative?1:1-a,l=i*e;s[l]=o,s.set(n,l+1)}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}}const ma=new I,Nh=new I,Oh=new Ue;class di{constructor(e=new I(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,i){return this.normal.set(e,t,n),this.constant=i,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){const i=ma.subVectors(n,t).cross(Nh.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(i,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){const n=e.delta(ma),i=this.normal.dot(n);if(i===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const s=-(e.start.dot(this.normal)+this.constant)/i;return s<0||s>1?null:t.copy(e.start).addScaledVector(n,s)}intersectsLine(e){const t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const n=t||Oh.getNormalMatrix(e),i=this.coplanarPoint(ma).applyMatrix4(e),s=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const ai=new on,Dh=new Ie(.5,.5),rs=new I;class ws{constructor(e=new di,t=new di,n=new di,i=new di,s=new di,a=new di){this.planes=[e,t,n,i,s,a]}set(e,t,n,i,s,a){const o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(i),o[4].copy(s),o[5].copy(a),this}copy(e){const t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=mn,n=!1){const i=this.planes,s=e.elements,a=s[0],o=s[1],l=s[2],c=s[3],u=s[4],h=s[5],d=s[6],f=s[7],_=s[8],g=s[9],m=s[10],p=s[11],v=s[12],y=s[13],E=s[14],R=s[15];if(i[0].setComponents(c-a,f-u,p-_,R-v).normalize(),i[1].setComponents(c+a,f+u,p+_,R+v).normalize(),i[2].setComponents(c+o,f+h,p+g,R+y).normalize(),i[3].setComponents(c-o,f-h,p-g,R-y).normalize(),n)i[4].setComponents(l,d,m,E).normalize(),i[5].setComponents(c-l,f-d,p-m,R-E).normalize();else if(i[4].setComponents(c-l,f-d,p-m,R-E).normalize(),t===mn)i[5].setComponents(c+l,f+d,p+m,R+E).normalize();else if(t===Cr)i[5].setComponents(l,d,m,E).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),ai.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),ai.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(ai)}intersectsSprite(e){ai.center.set(0,0,0);const t=Dh.distanceTo(e.center);return ai.radius=.7071067811865476+t,ai.applyMatrix4(e.matrixWorld),this.intersectsSphere(ai)}intersectsSphere(e){const t=this.planes,n=e.center,i=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(n)<i)return!1;return!0}intersectsBox(e){const t=this.planes;for(let n=0;n<6;n++){const i=t[n];if(rs.x=i.normal.x>0?e.max.x:e.min.x,rs.y=i.normal.y>0?e.max.y:e.min.y,rs.z=i.normal.z>0?e.max.z:e.min.z,i.distanceToPoint(rs)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class Ru extends Zt{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Le(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}}const As=new I,Ts=new I,Jl=new Ne,hr=new Ir,ss=new on,_a=new I,$l=new I;class Jo extends ut{constructor(e=new Pt,t=new Ru){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[0];for(let i=1,s=t.count;i<s;i++)As.fromBufferAttribute(t,i-1),Ts.fromBufferAttribute(t,i),n[i]=n[i-1],n[i]+=As.distanceTo(Ts);e.setAttribute("lineDistance",new mt(n,1))}else ye("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){const n=this.geometry,i=this.matrixWorld,s=e.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),ss.copy(n.boundingSphere),ss.applyMatrix4(i),ss.radius+=s,e.ray.intersectsSphere(ss)===!1)return;Jl.copy(i).invert(),hr.copy(e.ray).applyMatrix4(Jl);const o=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,u=n.index,d=n.attributes.position;if(u!==null){const f=Math.max(0,a.start),_=Math.min(u.count,a.start+a.count);for(let g=f,m=_-1;g<m;g+=c){const p=u.getX(g),v=u.getX(g+1),y=as(this,e,hr,l,p,v,g);y&&t.push(y)}if(this.isLineLoop){const g=u.getX(_-1),m=u.getX(f),p=as(this,e,hr,l,g,m,_-1);p&&t.push(p)}}else{const f=Math.max(0,a.start),_=Math.min(d.count,a.start+a.count);for(let g=f,m=_-1;g<m;g+=c){const p=as(this,e,hr,l,g,g+1,g);p&&t.push(p)}if(this.isLineLoop){const g=as(this,e,hr,l,_-1,f,_-1);g&&t.push(g)}}}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=i.length;s<a;s++){const o=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}}function as(r,e,t,n,i,s,a){const o=r.geometry.attributes.position;if(As.fromBufferAttribute(o,i),Ts.fromBufferAttribute(o,s),t.distanceSqToSegment(As,Ts,_a,$l)>n)return;_a.applyMatrix4(r.matrixWorld);const c=e.ray.origin.distanceTo(_a);if(!(c<e.near||c>e.far))return{distance:c,point:$l.clone().applyMatrix4(r.matrixWorld),index:a,face:null,faceIndex:null,barycoord:null,object:r}}const ec=new I,tc=new I;class Uh extends Jo{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[];for(let i=0,s=t.count;i<s;i+=2)ec.fromBufferAttribute(t,i),tc.fromBufferAttribute(t,i+1),n[i]=i===0?0:n[i-1],n[i+1]=n[i]+ec.distanceTo(tc);e.setAttribute("lineDistance",new mt(n,1))}else ye("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class Fh extends Jo{constructor(e,t){super(e,t),this.isLineLoop=!0,this.type="LineLoop"}}class Cu extends Zt{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Le(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}const nc=new Ne,bo=new Ir,os=new on,ls=new I;class Bh extends ut{constructor(e=new Pt,t=new Cu){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){const n=this.geometry,i=this.matrixWorld,s=e.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),os.copy(n.boundingSphere),os.applyMatrix4(i),os.radius+=s,e.ray.intersectsSphere(os)===!1)return;nc.copy(i).invert(),bo.copy(e.ray).applyMatrix4(nc);const o=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,h=n.attributes.position;if(c!==null){const d=Math.max(0,a.start),f=Math.min(c.count,a.start+a.count);for(let _=d,g=f;_<g;_++){const m=c.getX(_);ls.fromBufferAttribute(h,m),ic(ls,m,l,i,e,t,this)}}else{const d=Math.max(0,a.start),f=Math.min(h.count,a.start+a.count);for(let _=d,g=f;_<g;_++)ls.fromBufferAttribute(h,_),ic(ls,_,l,i,e,t,this)}}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=i.length;s<a;s++){const o=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}}function ic(r,e,t,n,i,s,a){const o=bo.distanceSqToPoint(r);if(o<t){const l=new I;bo.closestPointToPoint(r,l),l.applyMatrix4(n);const c=i.ray.origin.distanceTo(l);if(c<i.near||c>i.far)return;s.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:a})}}class Lu extends Et{constructor(e=[],t=mi,n,i,s,a,o,l,c,u){super(e,t,n,i,s,a,o,l,c,u),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class kh extends Et{constructor(e,t,n,i,s,a,o,l,c){super(e,t,n,i,s,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class wr extends Et{constructor(e,t,n=xn,i,s,a,o=St,l=St,c,u=Gn,h=1){if(u!==Gn&&u!==pi)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const d={width:e,height:t,depth:h};super(d,i,s,a,o,l,u,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new qo(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}class zh extends wr{constructor(e,t=xn,n=mi,i,s,a=St,o=St,l,c=Gn){const u={width:e,height:e,depth:1},h=[u,u,u,u,u,u];super(e,e,t,n,i,s,a,o,l,c),this.image=h,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}}class wu extends Et{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class Nr extends Pt{constructor(e=1,t=1,n=1,i=1,s=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:i,heightSegments:s,depthSegments:a};const o=this;i=Math.floor(i),s=Math.floor(s),a=Math.floor(a);const l=[],c=[],u=[],h=[];let d=0,f=0;_("z","y","x",-1,-1,n,t,e,a,s,0),_("z","y","x",1,-1,n,t,-e,a,s,1),_("x","z","y",1,1,e,n,t,i,a,2),_("x","z","y",1,-1,e,n,-t,i,a,3),_("x","y","z",1,-1,e,t,n,i,s,4),_("x","y","z",-1,-1,e,t,-n,i,s,5),this.setIndex(l),this.setAttribute("position",new mt(c,3)),this.setAttribute("normal",new mt(u,3)),this.setAttribute("uv",new mt(h,2));function _(g,m,p,v,y,E,R,T,L,x,b){const V=E/L,C=R/x,D=E/2,U=R/2,H=T/2,G=L+1,B=x+1;let z=0,$=0;const Y=new I;for(let ce=0;ce<B;ce++){const pe=ce*C-U;for(let de=0;de<G;de++){const Fe=de*V-D;Y[g]=Fe*v,Y[m]=pe*y,Y[p]=H,c.push(Y.x,Y.y,Y.z),Y[g]=0,Y[m]=0,Y[p]=T>0?1:-1,u.push(Y.x,Y.y,Y.z),h.push(de/L),h.push(1-ce/x),z+=1}}for(let ce=0;ce<x;ce++)for(let pe=0;pe<L;pe++){const de=d+pe+G*ce,Fe=d+pe+G*(ce+1),ct=d+(pe+1)+G*(ce+1),ot=d+(pe+1)+G*ce;l.push(de,Fe,ot),l.push(Fe,ct,ot),$+=6}o.addGroup(f,$,b),f+=$,d+=z}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Nr(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}class Pr extends Pt{constructor(e=1,t=1,n=1,i=32,s=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:i,heightSegments:s,openEnded:a,thetaStart:o,thetaLength:l};const c=this;i=Math.floor(i),s=Math.floor(s);const u=[],h=[],d=[],f=[];let _=0;const g=[],m=n/2;let p=0;v(),a===!1&&(e>0&&y(!0),t>0&&y(!1)),this.setIndex(u),this.setAttribute("position",new mt(h,3)),this.setAttribute("normal",new mt(d,3)),this.setAttribute("uv",new mt(f,2));function v(){const E=new I,R=new I;let T=0;const L=(t-e)/n;for(let x=0;x<=s;x++){const b=[],V=x/s,C=V*(t-e)+e;for(let D=0;D<=i;D++){const U=D/i,H=U*l+o,G=Math.sin(H),B=Math.cos(H);R.x=C*G,R.y=-V*n+m,R.z=C*B,h.push(R.x,R.y,R.z),E.set(G,L,B).normalize(),d.push(E.x,E.y,E.z),f.push(U,1-V),b.push(_++)}g.push(b)}for(let x=0;x<i;x++)for(let b=0;b<s;b++){const V=g[b][x],C=g[b+1][x],D=g[b+1][x+1],U=g[b][x+1];(e>0||b!==0)&&(u.push(V,C,U),T+=3),(t>0||b!==s-1)&&(u.push(C,D,U),T+=3)}c.addGroup(p,T,0),p+=T}function y(E){const R=_,T=new Ie,L=new I;let x=0;const b=E===!0?e:t,V=E===!0?1:-1;for(let D=1;D<=i;D++)h.push(0,m*V,0),d.push(0,V,0),f.push(.5,.5),_++;const C=_;for(let D=0;D<=i;D++){const H=D/i*l+o,G=Math.cos(H),B=Math.sin(H);L.x=b*B,L.y=m*V,L.z=b*G,h.push(L.x,L.y,L.z),d.push(0,V,0),T.x=G*.5+.5,T.y=B*.5*V+.5,f.push(T.x,T.y),_++}for(let D=0;D<i;D++){const U=R+D,H=C+D;E===!0?u.push(H,H+1,U):u.push(H+1,H,U),x+=3}c.addGroup(p,x,E===!0?1:2),p+=x}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Pr(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class Pu extends Pr{constructor(e=1,t=1,n=32,i=1,s=!1,a=0,o=Math.PI*2){super(0,e,t,n,i,s,a,o),this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:n,heightSegments:i,openEnded:s,thetaStart:a,thetaLength:o}}static fromJSON(e){return new Pu(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class Or extends Pt{constructor(e=1,t=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:i};const s=e/2,a=t/2,o=Math.floor(n),l=Math.floor(i),c=o+1,u=l+1,h=e/o,d=t/l,f=[],_=[],g=[],m=[];for(let p=0;p<u;p++){const v=p*d-a;for(let y=0;y<c;y++){const E=y*h-s;_.push(E,-v,0),g.push(0,0,1),m.push(y/o),m.push(1-p/l)}}for(let p=0;p<l;p++)for(let v=0;v<o;v++){const y=v+c*p,E=v+c*(p+1),R=v+1+c*(p+1),T=v+1+c*p;f.push(y,E,T),f.push(E,R,T)}this.setIndex(f),this.setAttribute("position",new mt(_,3)),this.setAttribute("normal",new mt(g,3)),this.setAttribute("uv",new mt(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Or(e.width,e.height,e.widthSegments,e.heightSegments)}}class Iu extends Pt{constructor(e=1,t=32,n=16,i=0,s=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:i,phiLength:s,thetaStart:a,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));const l=Math.min(a+o,Math.PI);let c=0;const u=[],h=new I,d=new I,f=[],_=[],g=[],m=[];for(let p=0;p<=n;p++){const v=[],y=p/n;let E=0;p===0&&a===0?E=.5/t:p===n&&l===Math.PI&&(E=-.5/t);for(let R=0;R<=t;R++){const T=R/t;h.x=-e*Math.cos(i+T*s)*Math.sin(a+y*o),h.y=e*Math.cos(a+y*o),h.z=e*Math.sin(i+T*s)*Math.sin(a+y*o),_.push(h.x,h.y,h.z),d.copy(h).normalize(),g.push(d.x,d.y,d.z),m.push(T+E,1-y),v.push(c++)}u.push(v)}for(let p=0;p<n;p++)for(let v=0;v<t;v++){const y=u[p][v+1],E=u[p][v],R=u[p+1][v],T=u[p+1][v+1];(p!==0||a>0)&&f.push(y,E,T),(p!==n-1||l<Math.PI)&&f.push(E,R,T)}this.setIndex(f),this.setAttribute("position",new mt(_,3)),this.setAttribute("normal",new mt(g,3)),this.setAttribute("uv",new mt(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Iu(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}}function Qi(r){const e={};for(const t in r){e[t]={};for(const n in r[t]){const i=r[t][n];i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)?i.isRenderTargetTexture?(ye("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=i.clone():Array.isArray(i)?e[t][n]=i.slice():e[t][n]=i}}return e}function Ft(r){const e={};for(let t=0;t<r.length;t++){const n=Qi(r[t]);for(const i in n)e[i]=n[i]}return e}function Hh(r){const e=[];for(let t=0;t<r.length;t++)e.push(r[t].clone());return e}function Nu(r){const e=r.getRenderTarget();return e===null?r.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:Xe.workingColorSpace}const Gh={clone:Qi,merge:Ft};var Vh=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Wh=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Sn extends Zt{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Vh,this.fragmentShader=Wh,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Qi(e.uniforms),this.uniformsGroups=Hh(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const i in this.uniforms){const a=this.uniforms[i].value;a&&a.isTexture?t.uniforms[i]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[i]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[i]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[i]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[i]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[i]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[i]={type:"m4",value:a.toArray()}:t.uniforms[i]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const n={};for(const i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}}class Xh extends Sn{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}}class Ps extends Zt{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Le(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Le(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Vo,this.normalScale=new Ie(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new an,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class En extends Ps{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new Ie(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return Ge(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new Le(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Le(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Le(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}}class LM extends Zt{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new Le(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Le(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Vo,this.normalScale=new Ie(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new an,this.combine=Do,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class Kh extends Zt{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Nd,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class qh extends Zt{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}function cs(r,e){return!r||r.constructor===e?r:typeof e.BYTES_PER_ELEMENT=="number"?new e(r):Array.prototype.slice.call(r)}function jh(r){function e(i,s){return r[i]-r[s]}const t=r.length,n=new Array(t);for(let i=0;i!==t;++i)n[i]=i;return n.sort(e),n}function rc(r,e,t){const n=r.length,i=new r.constructor(n);for(let s=0,a=0;a!==n;++s){const o=t[s]*e;for(let l=0;l!==e;++l)i[a++]=r[o+l]}return i}function Ou(r,e,t,n){let i=1,s=r[0];for(;s!==void 0&&s[n]===void 0;)s=r[i++];if(s===void 0)return;let a=s[n];if(a!==void 0)if(Array.isArray(a))do a=s[n],a!==void 0&&(e.push(s.time),t.push(...a)),s=r[i++];while(s!==void 0);else if(a.toArray!==void 0)do a=s[n],a!==void 0&&(e.push(s.time),a.toArray(t,t.length)),s=r[i++];while(s!==void 0);else do a=s[n],a!==void 0&&(e.push(s.time),t.push(a)),s=r[i++];while(s!==void 0)}class $i{constructor(e,t,n,i){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){const t=this.parameterPositions;let n=this._cachedIndex,i=t[n],s=t[n-1];n:{e:{let a;t:{i:if(!(e<i)){for(let o=n+2;;){if(i===void 0){if(e<s)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(s=i,i=t[++n],e<i)break e}a=t.length;break t}if(!(e>=s)){const o=t[1];e<o&&(n=2,s=o);for(let l=n-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(i=s,s=t[--n-1],e>=s)break e}a=n,n=0;break t}break n}for(;n<a;){const o=n+a>>>1;e<t[o]?a=o:n=o+1}if(i=t[n],s=t[n-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,s,i)}return this.interpolate_(n,s,e,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){const t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,s=e*i;for(let a=0;a!==i;++a)t[a]=n[s+a];return t}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}}class Qh extends $i{constructor(e,t,n,i){super(e,t,n,i),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:vl,endingEnd:vl}}intervalChanged_(e,t,n){const i=this.parameterPositions;let s=e-2,a=e+1,o=i[s],l=i[a];if(o===void 0)switch(this.getSettings_().endingStart){case El:s=e,o=2*t-n;break;case yl:s=i.length-2,o=t+i[s]-i[s+1];break;default:s=e,o=n}if(l===void 0)switch(this.getSettings_().endingEnd){case El:a=e,l=2*n-t;break;case yl:a=1,l=n+i[1]-i[0];break;default:a=e-1,l=t}const c=(n-t)*.5,u=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(l-n),this._offsetPrev=s*u,this._offsetNext=a*u}interpolate_(e,t,n,i){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,u=this._offsetPrev,h=this._offsetNext,d=this._weightPrev,f=this._weightNext,_=(n-t)/(i-t),g=_*_,m=g*_,p=-d*m+2*d*g-d*_,v=(1+d)*m+(-1.5-2*d)*g+(-.5+d)*_+1,y=(-1-f)*m+(1.5+f)*g+.5*_,E=f*m-f*g;for(let R=0;R!==o;++R)s[R]=p*a[u+R]+v*a[c+R]+y*a[l+R]+E*a[h+R];return s}}class Yh extends $i{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,u=(n-t)/(i-t),h=1-u;for(let d=0;d!==o;++d)s[d]=a[c+d]*h+a[l+d]*u;return s}}class Zh extends $i{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e){return this.copySampleValue_(e-1)}}class Jh extends $i{interpolate_(e,t,n,i){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,u=this.settings||this.DefaultSettings_,h=u.inTangents,d=u.outTangents;if(!h||!d){const g=(n-t)/(i-t),m=1-g;for(let p=0;p!==o;++p)s[p]=a[c+p]*m+a[l+p]*g;return s}const f=o*2,_=e-1;for(let g=0;g!==o;++g){const m=a[c+g],p=a[l+g],v=_*f+g*2,y=d[v],E=d[v+1],R=e*f+g*2,T=h[R],L=h[R+1];let x=(n-t)/(i-t),b,V,C,D,U;for(let H=0;H<8;H++){b=x*x,V=b*x,C=1-x,D=C*C,U=D*C;const B=U*t+3*D*x*y+3*C*b*T+V*i-n;if(Math.abs(B)<1e-10)break;const z=3*D*(y-t)+6*C*x*(T-y)+3*b*(i-T);if(Math.abs(z)<1e-10)break;x=x-B/z,x=Math.max(0,Math.min(1,x))}s[g]=U*m+3*D*x*E+3*C*b*L+V*p}return s}}class ln{constructor(e,t,n,i){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=cs(t,this.TimeBufferType),this.values=cs(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(e){const t=e.constructor;let n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:cs(e.times,Array),values:cs(e.values,Array)};const i=e.getInterpolation();i!==e.DefaultInterpolation&&(n.interpolation=i)}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new Zh(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Yh(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Qh(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){const t=new Jh(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.settings=this.settings),t}setInterpolation(e){let t;switch(e){case Tr:t=this.InterpolantFactoryMethodDiscrete;break;case Rr:t=this.InterpolantFactoryMethodLinear;break;case Ws:t=this.InterpolantFactoryMethodSmooth;break;case Sl:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){const n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return ye("KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Tr;case this.InterpolantFactoryMethodLinear:return Rr;case this.InterpolantFactoryMethodSmooth:return Ws;case this.InterpolantFactoryMethodBezier:return Sl}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){const t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]+=e}return this}scale(e){if(e!==1){const t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]*=e}return this}trim(e,t){const n=this.times,i=n.length;let s=0,a=i-1;for(;s!==i&&n[s]<e;)++s;for(;a!==-1&&n[a]>t;)--a;if(++a,s!==0||a!==i){s>=a&&(a=Math.max(a,1),s=a-1);const o=this.getValueSize();this.times=n.slice(s,a),this.values=this.values.slice(s*o,a*o)}return this}validate(){let e=!0;const t=this.getValueSize();t-Math.floor(t)!==0&&(Te("KeyframeTrack: Invalid value size in track.",this),e=!1);const n=this.times,i=this.values,s=n.length;s===0&&(Te("KeyframeTrack: Track is empty.",this),e=!1);let a=null;for(let o=0;o!==s;o++){const l=n[o];if(typeof l=="number"&&isNaN(l)){Te("KeyframeTrack: Time is not a valid number.",this,o,l),e=!1;break}if(a!==null&&a>l){Te("KeyframeTrack: Out of order keys.",this,o,l,a),e=!1;break}a=l}if(i!==void 0&&Gd(i))for(let o=0,l=i.length;o!==l;++o){const c=i[o];if(isNaN(c)){Te("KeyframeTrack: Value is not a valid number.",this,o,c),e=!1;break}}return e}optimize(){const e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),i=this.getInterpolation()===Ws,s=e.length-1;let a=1;for(let o=1;o<s;++o){let l=!1;const c=e[o],u=e[o+1];if(c!==u&&(o!==1||c!==e[0]))if(i)l=!0;else{const h=o*n,d=h-n,f=h+n;for(let _=0;_!==n;++_){const g=t[h+_];if(g!==t[d+_]||g!==t[f+_]){l=!0;break}}}if(l){if(o!==a){e[a]=e[o];const h=o*n,d=a*n;for(let f=0;f!==n;++f)t[d+f]=t[h+f]}++a}}if(s>0){e[a]=e[s];for(let o=s*n,l=a*n,c=0;c!==n;++c)t[l+c]=t[o+c];++a}return a!==e.length?(this.times=e.slice(0,a),this.values=t.slice(0,a*n)):(this.times=e,this.values=t),this}clone(){const e=this.times.slice(),t=this.values.slice(),n=this.constructor,i=new n(this.name,e,t);return i.createInterpolant=this.createInterpolant,i}}ln.prototype.ValueTypeName="";ln.prototype.TimeBufferType=Float32Array;ln.prototype.ValueBufferType=Float32Array;ln.prototype.DefaultInterpolation=Rr;class er extends ln{constructor(e,t,n){super(e,t,n)}}er.prototype.ValueTypeName="bool";er.prototype.ValueBufferType=Array;er.prototype.DefaultInterpolation=Tr;er.prototype.InterpolantFactoryMethodLinear=void 0;er.prototype.InterpolantFactoryMethodSmooth=void 0;class Du extends ln{constructor(e,t,n,i){super(e,t,n,i)}}Du.prototype.ValueTypeName="color";class Yi extends ln{constructor(e,t,n,i){super(e,t,n,i)}}Yi.prototype.ValueTypeName="number";class $h extends $i{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(n-t)/(i-t);let c=e*o;for(let u=c+o;c!==u;c+=4)vn.slerpFlat(s,0,a,c-o,a,c,l);return s}}class Zi extends ln{constructor(e,t,n,i){super(e,t,n,i)}InterpolantFactoryMethodLinear(e){return new $h(this.times,this.values,this.getValueSize(),e)}}Zi.prototype.ValueTypeName="quaternion";Zi.prototype.InterpolantFactoryMethodSmooth=void 0;class tr extends ln{constructor(e,t,n){super(e,t,n)}}tr.prototype.ValueTypeName="string";tr.prototype.ValueBufferType=Array;tr.prototype.DefaultInterpolation=Tr;tr.prototype.InterpolantFactoryMethodLinear=void 0;tr.prototype.InterpolantFactoryMethodSmooth=void 0;class Ji extends ln{constructor(e,t,n,i){super(e,t,n,i)}}Ji.prototype.ValueTypeName="vector";class ef{constructor(e="",t=-1,n=[],i=Pd){this.name=e,this.tracks=n,this.duration=t,this.blendMode=i,this.uuid=sn(),this.userData={},this.duration<0&&this.resetDuration()}static parse(e){const t=[],n=e.tracks,i=1/(e.fps||1);for(let a=0,o=n.length;a!==o;++a)t.push(nf(n[a]).scale(i));const s=new this(e.name,e.duration,t,e.blendMode);return s.uuid=e.uuid,s.userData=JSON.parse(e.userData||"{}"),s}static toJSON(e){const t=[],n=e.tracks,i={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode,userData:JSON.stringify(e.userData)};for(let s=0,a=n.length;s!==a;++s)t.push(ln.toJSON(n[s]));return i}static CreateFromMorphTargetSequence(e,t,n,i){const s=t.length,a=[];for(let o=0;o<s;o++){let l=[],c=[];l.push((o+s-1)%s,o,(o+1)%s),c.push(0,1,0);const u=jh(l);l=rc(l,1,u),c=rc(c,1,u),!i&&l[0]===0&&(l.push(s),c.push(c[0])),a.push(new Yi(".morphTargetInfluences["+t[o].name+"]",l,c).scale(1/n))}return new this(e,-1,a)}static findByName(e,t){let n=e;if(!Array.isArray(e)){const i=e;n=i.geometry&&i.geometry.animations||i.animations}for(let i=0;i<n.length;i++)if(n[i].name===t)return n[i];return null}static CreateClipsFromMorphTargetSequences(e,t,n){const i={},s=/^([\w-]*?)([\d]+)$/;for(let o=0,l=e.length;o<l;o++){const c=e[o],u=c.name.match(s);if(u&&u.length>1){const h=u[1];let d=i[h];d||(i[h]=d=[]),d.push(c)}}const a=[];for(const o in i)a.push(this.CreateFromMorphTargetSequence(o,i[o],t,n));return a}static parseAnimation(e,t){if(ye("AnimationClip: parseAnimation() is deprecated and will be removed with r185"),!e)return Te("AnimationClip: No animation in JSONLoader data."),null;const n=function(h,d,f,_,g){if(f.length!==0){const m=[],p=[];Ou(f,m,p,_),m.length!==0&&g.push(new h(d,m,p))}},i=[],s=e.name||"default",a=e.fps||30,o=e.blendMode;let l=e.length||-1;const c=e.hierarchy||[];for(let h=0;h<c.length;h++){const d=c[h].keys;if(!(!d||d.length===0))if(d[0].morphTargets){const f={};let _;for(_=0;_<d.length;_++)if(d[_].morphTargets)for(let g=0;g<d[_].morphTargets.length;g++)f[d[_].morphTargets[g]]=-1;for(const g in f){const m=[],p=[];for(let v=0;v!==d[_].morphTargets.length;++v){const y=d[_];m.push(y.time),p.push(y.morphTarget===g?1:0)}i.push(new Yi(".morphTargetInfluence["+g+"]",m,p))}l=f.length*a}else{const f=".bones["+t[h].name+"]";n(Ji,f+".position",d,"pos",i),n(Zi,f+".quaternion",d,"rot",i),n(Ji,f+".scale",d,"scl",i)}}return i.length===0?null:new this(s,l,i,o)}resetDuration(){const e=this.tracks;let t=0;for(let n=0,i=e.length;n!==i;++n){const s=this.tracks[n];t=Math.max(t,s.times[s.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){const e=[];for(let n=0;n<this.tracks.length;n++)e.push(this.tracks[n].clone());const t=new this.constructor(this.name,this.duration,e,this.blendMode);return t.userData=JSON.parse(JSON.stringify(this.userData)),t}toJSON(){return this.constructor.toJSON(this)}}function tf(r){switch(r.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return Yi;case"vector":case"vector2":case"vector3":case"vector4":return Ji;case"color":return Du;case"quaternion":return Zi;case"bool":case"boolean":return er;case"string":return tr}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+r)}function nf(r){if(r.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");const e=tf(r.type);if(r.times===void 0){const t=[],n=[];Ou(r.keys,t,n,"value"),r.times=t,r.values=n}return e.parse!==void 0?e.parse(r):new e(r.name,r.times,r.values,r.interpolation)}const Un={enabled:!1,files:{},add:function(r,e){this.enabled!==!1&&(sc(r)||(this.files[r]=e))},get:function(r){if(this.enabled!==!1&&!sc(r))return this.files[r]},remove:function(r){delete this.files[r]},clear:function(){this.files={}}};function sc(r){try{const e=r.slice(r.indexOf(":")+1);return new URL(e).protocol==="blob:"}catch{return!1}}class rf{constructor(e,t,n){const i=this;let s=!1,a=0,o=0,l;const c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(u){o++,s===!1&&i.onStart!==void 0&&i.onStart(u,a,o),s=!0},this.itemEnd=function(u){a++,i.onProgress!==void 0&&i.onProgress(u,a,o),a===o&&(s=!1,i.onLoad!==void 0&&i.onLoad())},this.itemError=function(u){i.onError!==void 0&&i.onError(u)},this.resolveURL=function(u){return l?l(u):u},this.setURLModifier=function(u){return l=u,this},this.addHandler=function(u,h){return c.push(u,h),this},this.removeHandler=function(u){const h=c.indexOf(u);return h!==-1&&c.splice(h,2),this},this.getHandler=function(u){for(let h=0,d=c.length;h<d;h+=2){const f=c[h],_=c[h+1];if(f.global&&(f.lastIndex=0),f.test(u))return _}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}}const sf=new rf;class gi{constructor(e){this.manager=e!==void 0?e:sf,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){const n=this;return new Promise(function(i,s){n.load(e,i,t,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}}gi.DEFAULT_MATERIAL_NAME="__DEFAULT";const wn={};class af extends Error{constructor(e,t){super(e),this.response=t}}class Rs extends gi{constructor(e){super(e),this.mimeType="",this.responseType="",this._abortController=new AbortController}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const s=Un.get(`file:${e}`);if(s!==void 0)return this.manager.itemStart(e),setTimeout(()=>{t&&t(s),this.manager.itemEnd(e)},0),s;if(wn[e]!==void 0){wn[e].push({onLoad:t,onProgress:n,onError:i});return}wn[e]=[],wn[e].push({onLoad:t,onProgress:n,onError:i});const a=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin",signal:typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal}),o=this.mimeType,l=this.responseType;fetch(a).then(c=>{if(c.status===200||c.status===0){if(c.status===0&&ye("FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||c.body===void 0||c.body.getReader===void 0)return c;const u=wn[e],h=c.body.getReader(),d=c.headers.get("X-File-Size")||c.headers.get("Content-Length"),f=d?parseInt(d):0,_=f!==0;let g=0;const m=new ReadableStream({start(p){v();function v(){h.read().then(({done:y,value:E})=>{if(y)p.close();else{g+=E.byteLength;const R=new ProgressEvent("progress",{lengthComputable:_,loaded:g,total:f});for(let T=0,L=u.length;T<L;T++){const x=u[T];x.onProgress&&x.onProgress(R)}p.enqueue(E),v()}},y=>{p.error(y)})}}});return new Response(m)}else throw new af(`fetch for "${c.url}" responded with ${c.status}: ${c.statusText}`,c)}).then(c=>{switch(l){case"arraybuffer":return c.arrayBuffer();case"blob":return c.blob();case"document":return c.text().then(u=>new DOMParser().parseFromString(u,o));case"json":return c.json();default:if(o==="")return c.text();{const h=/charset="?([^;"\s]*)"?/i.exec(o),d=h&&h[1]?h[1].toLowerCase():void 0,f=new TextDecoder(d);return c.arrayBuffer().then(_=>f.decode(_))}}}).then(c=>{Un.add(`file:${e}`,c);const u=wn[e];delete wn[e];for(let h=0,d=u.length;h<d;h++){const f=u[h];f.onLoad&&f.onLoad(c)}}).catch(c=>{const u=wn[e];if(u===void 0)throw this.manager.itemError(e),c;delete wn[e];for(let h=0,d=u.length;h<d;h++){const f=u[h];f.onError&&f.onError(c)}this.manager.itemError(e)}).finally(()=>{this.manager.itemEnd(e)}),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}}const Ui=new WeakMap;class of extends gi{constructor(e){super(e)}load(e,t,n,i){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const s=this,a=Un.get(`image:${e}`);if(a!==void 0){if(a.complete===!0)s.manager.itemStart(e),setTimeout(function(){t&&t(a),s.manager.itemEnd(e)},0);else{let h=Ui.get(a);h===void 0&&(h=[],Ui.set(a,h)),h.push({onLoad:t,onError:i})}return a}const o=Lr("img");function l(){u(),t&&t(this);const h=Ui.get(this)||[];for(let d=0;d<h.length;d++){const f=h[d];f.onLoad&&f.onLoad(this)}Ui.delete(this),s.manager.itemEnd(e)}function c(h){u(),i&&i(h),Un.remove(`image:${e}`);const d=Ui.get(this)||[];for(let f=0;f<d.length;f++){const _=d[f];_.onError&&_.onError(h)}Ui.delete(this),s.manager.itemError(e),s.manager.itemEnd(e)}function u(){o.removeEventListener("load",l,!1),o.removeEventListener("error",c,!1)}return o.addEventListener("load",l,!1),o.addEventListener("error",c,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(o.crossOrigin=this.crossOrigin),Un.add(`image:${e}`,o),s.manager.itemStart(e),o.src=e,o}}class Uu extends gi{constructor(e){super(e)}load(e,t,n,i){const s=new Et,a=new of(this.manager);return a.setCrossOrigin(this.crossOrigin),a.setPath(this.path),a.load(e,function(o){s.image=o,s.needsUpdate=!0,t!==void 0&&t(s)},n,i),s}}class Is extends ut{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new Le(e),this.intensity=t}dispose(){this.dispatchEvent({type:"dispose"})}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}}const ga=new Ne,ac=new I,oc=new I;class $o{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Ie(512,512),this.mapType=Wt,this.map=null,this.mapPass=null,this.matrix=new Ne,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new ws,this._frameExtents=new Ie(1,1),this._viewportCount=1,this._viewports=[new lt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,n=this.matrix;ac.setFromMatrixPosition(e.matrixWorld),t.position.copy(ac),oc.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(oc),t.updateMatrixWorld(),ga.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(ga,t.coordinateSystem,t.reversedDepth),t.coordinateSystem===Cr||t.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(ga)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}const us=new I,ds=new vn,un=new I;class Fu extends ut{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Ne,this.projectionMatrix=new Ne,this.projectionMatrixInverse=new Ne,this.coordinateSystem=mn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(us,ds,un),un.x===1&&un.y===1&&un.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(us,ds,un.set(1,1,1)).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorld.decompose(us,ds,un),un.x===1&&un.y===1&&un.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(us,ds,un.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}}const Zn=new I,lc=new Ie,cc=new Ie;class kt extends Fu{constructor(e=50,t=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=qi*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(Sr*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return qi*2*Math.atan(Math.tan(Sr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Zn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Zn.x,Zn.y).multiplyScalar(-e/Zn.z),Zn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Zn.x,Zn.y).multiplyScalar(-e/Zn.z)}getViewSize(e,t){return this.getViewBounds(e,lc,cc),t.subVectors(cc,lc)}setViewOffset(e,t,n,i,s,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=s,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(Sr*.5*this.fov)/this.zoom,n=2*t,i=this.aspect*n,s=-.5*i;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;s+=a.offsetX*i/l,t-=a.offsetY*n/c,i*=a.width/l,n*=a.height/c}const o=this.filmOffset;o!==0&&(s+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+i,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}class lf extends $o{constructor(){super(new kt(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1,this.aspect=1}updateMatrices(e){const t=this.camera,n=qi*2*e.angle*this.focus,i=this.mapSize.width/this.mapSize.height*this.aspect,s=e.distance||t.far;(n!==t.fov||i!==t.aspect||s!==t.far)&&(t.fov=n,t.aspect=i,t.far=s,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this}}class cf extends Is{constructor(e,t,n=0,i=Math.PI/3,s=0,a=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(ut.DEFAULT_UP),this.updateMatrix(),this.target=new ut,this.distance=n,this.angle=i,this.penumbra=s,this.decay=a,this.map=null,this.shadow=new lf}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.map=e.map,this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.distance=this.distance,t.object.angle=this.angle,t.object.decay=this.decay,t.object.penumbra=this.penumbra,t.object.target=this.target.uuid,this.map&&this.map.isTexture&&(t.object.map=this.map.toJSON(e).uuid),t.object.shadow=this.shadow.toJSON(),t}}class uf extends $o{constructor(){super(new kt(90,1,.5,500)),this.isPointLightShadow=!0}}class df extends Is{constructor(e,t,n=0,i=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=i,this.shadow=new uf}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}}class Ns extends Fu{constructor(e=-1,t=1,n=1,i=-1,s=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=i,this.near=s,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,i,s,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=s,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2;let s=n-e,a=n+e,o=i+t,l=i-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,a=s+c*this.view.width,o-=u*this.view.offsetY,l=o-u*this.view.height}this.projectionMatrix.makeOrthographic(s,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}class hf extends $o{constructor(){super(new Ns(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class ff extends Is{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(ut.DEFAULT_UP),this.updateMatrix(),this.target=new ut,this.shadow=new hf}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}}class wM extends Is{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type="AmbientLight"}}class Er{static extractUrlBase(e){const t=e.lastIndexOf("/");return t===-1?"./":e.slice(0,t+1)}static resolveURL(e,t){return typeof e!="string"||e===""?"":(/^https?:\/\//i.test(t)&&/^\//.test(e)&&(t=t.replace(/(^https?:\/\/[^\/]+).*/i,"$1")),/^(https?:)?\/\//i.test(e)||/^data:.*,.*$/i.test(e)||/^blob:.*$/i.test(e)?e:t+e)}}const Ma=new WeakMap;class pf extends gi{constructor(e){super(e),this.isImageBitmapLoader=!0,typeof createImageBitmap>"u"&&ye("ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch>"u"&&ye("ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"},this._abortController=new AbortController}setOptions(e){return this.options=e,this}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const s=this,a=Un.get(`image-bitmap:${e}`);if(a!==void 0){if(s.manager.itemStart(e),a.then){a.then(c=>{if(Ma.has(a)===!0)i&&i(Ma.get(a)),s.manager.itemError(e),s.manager.itemEnd(e);else return t&&t(c),s.manager.itemEnd(e),c});return}return setTimeout(function(){t&&t(a),s.manager.itemEnd(e)},0),a}const o={};o.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",o.headers=this.requestHeader,o.signal=typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal;const l=fetch(e,o).then(function(c){return c.blob()}).then(function(c){return createImageBitmap(c,Object.assign(s.options,{colorSpaceConversion:"none"}))}).then(function(c){return Un.add(`image-bitmap:${e}`,c),t&&t(c),s.manager.itemEnd(e),c}).catch(function(c){i&&i(c),Ma.set(l,c),Un.remove(`image-bitmap:${e}`),s.manager.itemError(e),s.manager.itemEnd(e)});Un.add(`image-bitmap:${e}`,l),s.manager.itemStart(e)}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}}const Fi=-90,Bi=1;class mf extends ut{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const i=new kt(Fi,Bi,e,t);i.layers=this.layers,this.add(i);const s=new kt(Fi,Bi,e,t);s.layers=this.layers,this.add(s);const a=new kt(Fi,Bi,e,t);a.layers=this.layers,this.add(a);const o=new kt(Fi,Bi,e,t);o.layers=this.layers,this.add(o);const l=new kt(Fi,Bi,e,t);l.layers=this.layers,this.add(l);const c=new kt(Fi,Bi,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[n,i,s,a,o,l]=t;for(const c of t)this.remove(c);if(e===mn)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Cr)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:i}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[s,a,o,l,c,u]=this.children,h=e.getRenderTarget(),d=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),_=e.xr.enabled;e.xr.enabled=!1;const g=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let m=!1;e.isWebGLRenderer===!0?m=e.state.buffers.depth.getReversed():m=e.reversedDepthBuffer,e.setRenderTarget(n,0,i),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(n,1,i),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,2,i),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,i),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(n,4,i),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.generateMipmaps=g,e.setRenderTarget(n,5,i),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,u),e.setRenderTarget(h,d,f),e.xr.enabled=_,n.texture.needsPMREMUpdate=!0}}class _f extends kt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}const el="\\[\\]\\.:\\/",gf=new RegExp("["+el+"]","g"),tl="[^"+el+"]",Mf="[^"+el.replace("\\.","")+"]",xf=/((?:WC+[\/:])*)/.source.replace("WC",tl),Sf=/(WCOD+)?/.source.replace("WCOD",Mf),vf=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",tl),Ef=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",tl),yf=new RegExp("^"+xf+Sf+vf+Ef+"$"),bf=["material","materials","bones","map"];class Af{constructor(e,t,n){const i=n||$e.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,i)}getValue(e,t){this.bind();const n=this._targetGroup.nCachedObjects_,i=this._bindings[n];i!==void 0&&i.getValue(e,t)}setValue(e,t){const n=this._bindings;for(let i=this._targetGroup.nCachedObjects_,s=n.length;i!==s;++i)n[i].setValue(e,t)}bind(){const e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){const e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}}class $e{constructor(e,t,n){this.path=t,this.parsedPath=n||$e.parseTrackName(t),this.node=$e.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new $e.Composite(e,t,n):new $e(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(gf,"")}static parseTrackName(e){const t=yf.exec(e);if(t===null)throw new Error("PropertyBinding: Cannot parse trackName: "+e);const n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},i=n.nodeName&&n.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){const s=n.nodeName.substring(i+1);bf.indexOf(s)!==-1&&(n.nodeName=n.nodeName.substring(0,i),n.objectName=s)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){const n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){const n=function(s){for(let a=0;a<s.length;a++){const o=s[a];if(o.name===t||o.uuid===t)return o;const l=n(o.children);if(l)return l}return null},i=n(e.children);if(i)return i}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){const n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)e[t++]=n[i]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){const n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=e[t++]}_setValue_array_setNeedsUpdate(e,t){const n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){const n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node;const t=this.parsedPath,n=t.objectName,i=t.propertyName;let s=t.propertyIndex;if(e||(e=$e.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){ye("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=t.objectIndex;switch(n){case"materials":if(!e.material){Te("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Te("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Te("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let u=0;u<e.length;u++)if(e[u].name===c){c=u;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Te("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Te("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[n]===void 0){Te("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(c!==void 0){if(e[c]===void 0){Te("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}const a=e[i];if(a===void 0){const c=t.nodeName;Te("PropertyBinding: Trying to update property for track: "+c+"."+i+" but it wasn't found.",e);return}let o=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?o=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(i==="morphTargetInfluences"){if(!e.geometry){Te("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Te("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=s}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=i;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}}$e.Composite=Af;$e.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};$e.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};$e.prototype.GetterByBindingType=[$e.prototype._getValue_direct,$e.prototype._getValue_array,$e.prototype._getValue_arrayElement,$e.prototype._getValue_toArray];$e.prototype.SetterByBindingTypeAndVersioning=[[$e.prototype._setValue_direct,$e.prototype._setValue_direct_setNeedsUpdate,$e.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[$e.prototype._setValue_array,$e.prototype._setValue_array_setNeedsUpdate,$e.prototype._setValue_array_setMatrixWorldNeedsUpdate],[$e.prototype._setValue_arrayElement,$e.prototype._setValue_arrayElement_setNeedsUpdate,$e.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[$e.prototype._setValue_fromArray,$e.prototype._setValue_fromArray_setNeedsUpdate,$e.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];const uc=new Ne;class PM{constructor(e,t,n=0,i=1/0){this.ray=new Ir(e,t),this.near=n,this.far=i,this.camera=null,this.layers=new jo,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,(t.near+t.far)/(t.near-t.far)).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):Te("Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return uc.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(uc),this}intersectObject(e,t=!0,n=[]){return Ao(e,this,n,t),n.sort(dc),n}intersectObjects(e,t=!0,n=[]){for(let i=0,s=e.length;i<s;i++)Ao(e[i],this,n,t);return n.sort(dc),n}}function dc(r,e){return r.distance-e.distance}function Ao(r,e,t,n){let i=!0;if(r.layers.test(e.layers)&&r.raycast(e,t)===!1&&(i=!1),i===!0&&n===!0){const s=r.children;for(let a=0,o=s.length;a<o;a++)Ao(s[a],e,t,!0)}}class IM{constructor(e=1,t=0,n=0){this.radius=e,this.phi=t,this.theta=n}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=Ge(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){return this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,n),this.phi=Math.acos(Ge(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}}class NM extends _i{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){if(e===void 0){ye("Controls: connect() now requires an element.");return}this.domElement!==null&&this.disconnect(),this.domElement=e}disconnect(){}dispose(){}update(){}}function hc(r,e,t,n){const i=Tf(n);switch(t){case gu:return r*e;case ko:return r*e/i.components*i.byteLength;case zo:return r*e/i.components*i.byteLength;case Ki:return r*e*2/i.components*i.byteLength;case Ho:return r*e*2/i.components*i.byteLength;case Mu:return r*e*3/i.components*i.byteLength;case Yt:return r*e*4/i.components*i.byteLength;case Go:return r*e*4/i.components*i.byteLength;case _s:case gs:return Math.floor((r+3)/4)*Math.floor((e+3)/4)*8;case Ms:case xs:return Math.floor((r+3)/4)*Math.floor((e+3)/4)*16;case Va:case Xa:return Math.max(r,16)*Math.max(e,8)/4;case Ga:case Wa:return Math.max(r,8)*Math.max(e,8)/2;case Ka:case qa:case Qa:case Ya:return Math.floor((r+3)/4)*Math.floor((e+3)/4)*8;case ja:case Za:case Ja:return Math.floor((r+3)/4)*Math.floor((e+3)/4)*16;case $a:return Math.floor((r+3)/4)*Math.floor((e+3)/4)*16;case eo:return Math.floor((r+4)/5)*Math.floor((e+3)/4)*16;case to:return Math.floor((r+4)/5)*Math.floor((e+4)/5)*16;case no:return Math.floor((r+5)/6)*Math.floor((e+4)/5)*16;case io:return Math.floor((r+5)/6)*Math.floor((e+5)/6)*16;case ro:return Math.floor((r+7)/8)*Math.floor((e+4)/5)*16;case so:return Math.floor((r+7)/8)*Math.floor((e+5)/6)*16;case ao:return Math.floor((r+7)/8)*Math.floor((e+7)/8)*16;case oo:return Math.floor((r+9)/10)*Math.floor((e+4)/5)*16;case lo:return Math.floor((r+9)/10)*Math.floor((e+5)/6)*16;case co:return Math.floor((r+9)/10)*Math.floor((e+7)/8)*16;case uo:return Math.floor((r+9)/10)*Math.floor((e+9)/10)*16;case ho:return Math.floor((r+11)/12)*Math.floor((e+9)/10)*16;case fo:return Math.floor((r+11)/12)*Math.floor((e+11)/12)*16;case po:case mo:case _o:return Math.ceil(r/4)*Math.ceil(e/4)*16;case go:case Mo:return Math.ceil(r/4)*Math.ceil(e/4)*8;case xo:case So:return Math.ceil(r/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function Tf(r){switch(r){case Wt:case fu:return{byteLength:1,components:1};case br:case pu:case Hn:return{byteLength:2,components:1};case Fo:case Bo:return{byteLength:2,components:4};case xn:case Uo:case Qt:return{byteLength:4,components:1};case mu:case _u:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${r}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Oo}}));typeof window<"u"&&(window.__THREE__?ye("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Oo);function Bu(){let r=null,e=!1,t=null,n=null;function i(s,a){t(s,a),n=r.requestAnimationFrame(i)}return{start:function(){e!==!0&&t!==null&&(n=r.requestAnimationFrame(i),e=!0)},stop:function(){r.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){r=s}}}function Rf(r){const e=new WeakMap;function t(o,l){const c=o.array,u=o.usage,h=c.byteLength,d=r.createBuffer();r.bindBuffer(l,d),r.bufferData(l,c,u),o.onUploadCallback();let f;if(c instanceof Float32Array)f=r.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)f=r.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?f=r.HALF_FLOAT:f=r.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=r.SHORT;else if(c instanceof Uint32Array)f=r.UNSIGNED_INT;else if(c instanceof Int32Array)f=r.INT;else if(c instanceof Int8Array)f=r.BYTE;else if(c instanceof Uint8Array)f=r.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=r.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:h}}function n(o,l,c){const u=l.array,h=l.updateRanges;if(r.bindBuffer(c,o),h.length===0)r.bufferSubData(c,0,u);else{h.sort((f,_)=>f.start-_.start);let d=0;for(let f=1;f<h.length;f++){const _=h[d],g=h[f];g.start<=_.start+_.count+1?_.count=Math.max(_.count,g.start+g.count-_.start):(++d,h[d]=g)}h.length=d+1;for(let f=0,_=h.length;f<_;f++){const g=h[f];r.bufferSubData(c,g.start*u.BYTES_PER_ELEMENT,u,g.start,g.count)}l.clearUpdateRanges()}l.onUploadCallback()}function i(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function s(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=e.get(o);l&&(r.deleteBuffer(l.buffer),e.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const u=e.get(o);(!u||u.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:i,remove:s,update:a}}var Cf=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Lf=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,wf=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Pf=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,If=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Nf=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Of=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Df=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Uf=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,Ff=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Bf=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,kf=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,zf=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Hf=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Gf=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Vf=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Wf=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Xf=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Kf=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,qf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,jf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Qf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Yf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Zf=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Jf=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,$f=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,ep=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,tp=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,np=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,ip=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,rp="gl_FragColor = linearToOutputTexel( gl_FragColor );",sp=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,ap=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,op=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,lp=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,cp=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,up=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,dp=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,hp=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,fp=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,pp=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,mp=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,_p=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,gp=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Mp=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,xp=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,Sp=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,vp=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Ep=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,yp=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,bp=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Ap=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Tp=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return v;
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Rp=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Cp=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Lp=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,wp=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Pp=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Ip=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Np=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Op=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Dp=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Up=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Fp=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Bp=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,kp=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,zp=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Hp=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Gp=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Vp=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Wp=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Xp=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Kp=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,qp=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,jp=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Qp=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,Yp=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Zp=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Jp=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,$p=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,em=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,tm=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,nm=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,im=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,rm=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,sm=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,am=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,om=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,lm=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,cm=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,um=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,dm=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,hm=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,fm=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,pm=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,mm=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,_m=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,gm=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Mm=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,xm=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Sm=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,vm=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Em=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,ym=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,bm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Am=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Tm=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Rm=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Cm=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Lm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,wm=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Pm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Im=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Nm=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Om=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Dm=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Um=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,Fm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Bm=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,km=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,zm=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Hm=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Gm=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Vm=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Wm=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Xm=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Km=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,qm=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,jm=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Qm=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Ym=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Zm=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Jm=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,$m=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,e_=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,t_=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,n_=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,i_=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,r_=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,s_=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,a_=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Be={alphahash_fragment:Cf,alphahash_pars_fragment:Lf,alphamap_fragment:wf,alphamap_pars_fragment:Pf,alphatest_fragment:If,alphatest_pars_fragment:Nf,aomap_fragment:Of,aomap_pars_fragment:Df,batching_pars_vertex:Uf,batching_vertex:Ff,begin_vertex:Bf,beginnormal_vertex:kf,bsdfs:zf,iridescence_fragment:Hf,bumpmap_pars_fragment:Gf,clipping_planes_fragment:Vf,clipping_planes_pars_fragment:Wf,clipping_planes_pars_vertex:Xf,clipping_planes_vertex:Kf,color_fragment:qf,color_pars_fragment:jf,color_pars_vertex:Qf,color_vertex:Yf,common:Zf,cube_uv_reflection_fragment:Jf,defaultnormal_vertex:$f,displacementmap_pars_vertex:ep,displacementmap_vertex:tp,emissivemap_fragment:np,emissivemap_pars_fragment:ip,colorspace_fragment:rp,colorspace_pars_fragment:sp,envmap_fragment:ap,envmap_common_pars_fragment:op,envmap_pars_fragment:lp,envmap_pars_vertex:cp,envmap_physical_pars_fragment:Sp,envmap_vertex:up,fog_vertex:dp,fog_pars_vertex:hp,fog_fragment:fp,fog_pars_fragment:pp,gradientmap_pars_fragment:mp,lightmap_pars_fragment:_p,lights_lambert_fragment:gp,lights_lambert_pars_fragment:Mp,lights_pars_begin:xp,lights_toon_fragment:vp,lights_toon_pars_fragment:Ep,lights_phong_fragment:yp,lights_phong_pars_fragment:bp,lights_physical_fragment:Ap,lights_physical_pars_fragment:Tp,lights_fragment_begin:Rp,lights_fragment_maps:Cp,lights_fragment_end:Lp,logdepthbuf_fragment:wp,logdepthbuf_pars_fragment:Pp,logdepthbuf_pars_vertex:Ip,logdepthbuf_vertex:Np,map_fragment:Op,map_pars_fragment:Dp,map_particle_fragment:Up,map_particle_pars_fragment:Fp,metalnessmap_fragment:Bp,metalnessmap_pars_fragment:kp,morphinstance_vertex:zp,morphcolor_vertex:Hp,morphnormal_vertex:Gp,morphtarget_pars_vertex:Vp,morphtarget_vertex:Wp,normal_fragment_begin:Xp,normal_fragment_maps:Kp,normal_pars_fragment:qp,normal_pars_vertex:jp,normal_vertex:Qp,normalmap_pars_fragment:Yp,clearcoat_normal_fragment_begin:Zp,clearcoat_normal_fragment_maps:Jp,clearcoat_pars_fragment:$p,iridescence_pars_fragment:em,opaque_fragment:tm,packing:nm,premultiplied_alpha_fragment:im,project_vertex:rm,dithering_fragment:sm,dithering_pars_fragment:am,roughnessmap_fragment:om,roughnessmap_pars_fragment:lm,shadowmap_pars_fragment:cm,shadowmap_pars_vertex:um,shadowmap_vertex:dm,shadowmask_pars_fragment:hm,skinbase_vertex:fm,skinning_pars_vertex:pm,skinning_vertex:mm,skinnormal_vertex:_m,specularmap_fragment:gm,specularmap_pars_fragment:Mm,tonemapping_fragment:xm,tonemapping_pars_fragment:Sm,transmission_fragment:vm,transmission_pars_fragment:Em,uv_pars_fragment:ym,uv_pars_vertex:bm,uv_vertex:Am,worldpos_vertex:Tm,background_vert:Rm,background_frag:Cm,backgroundCube_vert:Lm,backgroundCube_frag:wm,cube_vert:Pm,cube_frag:Im,depth_vert:Nm,depth_frag:Om,distance_vert:Dm,distance_frag:Um,equirect_vert:Fm,equirect_frag:Bm,linedashed_vert:km,linedashed_frag:zm,meshbasic_vert:Hm,meshbasic_frag:Gm,meshlambert_vert:Vm,meshlambert_frag:Wm,meshmatcap_vert:Xm,meshmatcap_frag:Km,meshnormal_vert:qm,meshnormal_frag:jm,meshphong_vert:Qm,meshphong_frag:Ym,meshphysical_vert:Zm,meshphysical_frag:Jm,meshtoon_vert:$m,meshtoon_frag:e_,points_vert:t_,points_frag:n_,shadow_vert:i_,shadow_frag:r_,sprite_vert:s_,sprite_frag:a_},ae={common:{diffuse:{value:new Le(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ue},alphaMap:{value:null},alphaMapTransform:{value:new Ue},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ue}},envmap:{envMap:{value:null},envMapRotation:{value:new Ue},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ue}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ue}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ue},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ue},normalScale:{value:new Ie(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ue},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ue}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ue}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ue}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Le(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Le(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ue},alphaTest:{value:0},uvTransform:{value:new Ue}},sprite:{diffuse:{value:new Le(16777215)},opacity:{value:1},center:{value:new Ie(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ue},alphaMap:{value:null},alphaMapTransform:{value:new Ue},alphaTest:{value:0}}},fn={basic:{uniforms:Ft([ae.common,ae.specularmap,ae.envmap,ae.aomap,ae.lightmap,ae.fog]),vertexShader:Be.meshbasic_vert,fragmentShader:Be.meshbasic_frag},lambert:{uniforms:Ft([ae.common,ae.specularmap,ae.envmap,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.fog,ae.lights,{emissive:{value:new Le(0)},envMapIntensity:{value:1}}]),vertexShader:Be.meshlambert_vert,fragmentShader:Be.meshlambert_frag},phong:{uniforms:Ft([ae.common,ae.specularmap,ae.envmap,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.fog,ae.lights,{emissive:{value:new Le(0)},specular:{value:new Le(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Be.meshphong_vert,fragmentShader:Be.meshphong_frag},standard:{uniforms:Ft([ae.common,ae.envmap,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.roughnessmap,ae.metalnessmap,ae.fog,ae.lights,{emissive:{value:new Le(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Be.meshphysical_vert,fragmentShader:Be.meshphysical_frag},toon:{uniforms:Ft([ae.common,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.gradientmap,ae.fog,ae.lights,{emissive:{value:new Le(0)}}]),vertexShader:Be.meshtoon_vert,fragmentShader:Be.meshtoon_frag},matcap:{uniforms:Ft([ae.common,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.fog,{matcap:{value:null}}]),vertexShader:Be.meshmatcap_vert,fragmentShader:Be.meshmatcap_frag},points:{uniforms:Ft([ae.points,ae.fog]),vertexShader:Be.points_vert,fragmentShader:Be.points_frag},dashed:{uniforms:Ft([ae.common,ae.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Be.linedashed_vert,fragmentShader:Be.linedashed_frag},depth:{uniforms:Ft([ae.common,ae.displacementmap]),vertexShader:Be.depth_vert,fragmentShader:Be.depth_frag},normal:{uniforms:Ft([ae.common,ae.bumpmap,ae.normalmap,ae.displacementmap,{opacity:{value:1}}]),vertexShader:Be.meshnormal_vert,fragmentShader:Be.meshnormal_frag},sprite:{uniforms:Ft([ae.sprite,ae.fog]),vertexShader:Be.sprite_vert,fragmentShader:Be.sprite_frag},background:{uniforms:{uvTransform:{value:new Ue},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Be.background_vert,fragmentShader:Be.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ue}},vertexShader:Be.backgroundCube_vert,fragmentShader:Be.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Be.cube_vert,fragmentShader:Be.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Be.equirect_vert,fragmentShader:Be.equirect_frag},distance:{uniforms:Ft([ae.common,ae.displacementmap,{referencePosition:{value:new I},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Be.distance_vert,fragmentShader:Be.distance_frag},shadow:{uniforms:Ft([ae.lights,ae.fog,{color:{value:new Le(0)},opacity:{value:1}}]),vertexShader:Be.shadow_vert,fragmentShader:Be.shadow_frag}};fn.physical={uniforms:Ft([fn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ue},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ue},clearcoatNormalScale:{value:new Ie(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ue},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ue},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ue},sheen:{value:0},sheenColor:{value:new Le(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ue},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ue},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ue},transmissionSamplerSize:{value:new Ie},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ue},attenuationDistance:{value:0},attenuationColor:{value:new Le(0)},specularColor:{value:new Le(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ue},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ue},anisotropyVector:{value:new Ie},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ue}}]),vertexShader:Be.meshphysical_vert,fragmentShader:Be.meshphysical_frag};const hs={r:0,b:0,g:0},oi=new an,o_=new Ne;function l_(r,e,t,n,i,s){const a=new Le(0);let o=i===!0?0:1,l,c,u=null,h=0,d=null;function f(v){let y=v.isScene===!0?v.background:null;if(y&&y.isTexture){const E=v.backgroundBlurriness>0;y=e.get(y,E)}return y}function _(v){let y=!1;const E=f(v);E===null?m(a,o):E&&E.isColor&&(m(E,1),y=!0);const R=r.xr.getEnvironmentBlendMode();R==="additive"?t.buffers.color.setClear(0,0,0,1,s):R==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,s),(r.autoClear||y)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),r.clear(r.autoClearColor,r.autoClearDepth,r.autoClearStencil))}function g(v,y){const E=f(y);E&&(E.isCubeTexture||E.mapping===Ls)?(c===void 0&&(c=new wt(new Nr(1,1,1),new Sn({name:"BackgroundCubeMaterial",uniforms:Qi(fn.backgroundCube.uniforms),vertexShader:fn.backgroundCube.vertexShader,fragmentShader:fn.backgroundCube.fragmentShader,side:zt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(R,T,L){this.matrixWorld.copyPosition(L.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(c)),oi.copy(y.backgroundRotation),oi.x*=-1,oi.y*=-1,oi.z*=-1,E.isCubeTexture&&E.isRenderTargetTexture===!1&&(oi.y*=-1,oi.z*=-1),c.material.uniforms.envMap.value=E,c.material.uniforms.flipEnvMap.value=E.isCubeTexture&&E.isRenderTargetTexture===!1?-1:1,c.material.uniforms.backgroundBlurriness.value=y.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=y.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(o_.makeRotationFromEuler(oi)),c.material.toneMapped=Xe.getTransfer(E.colorSpace)!==Ze,(u!==E||h!==E.version||d!==r.toneMapping)&&(c.material.needsUpdate=!0,u=E,h=E.version,d=r.toneMapping),c.layers.enableAll(),v.unshift(c,c.geometry,c.material,0,0,null)):E&&E.isTexture&&(l===void 0&&(l=new wt(new Or(2,2),new Sn({name:"BackgroundMaterial",uniforms:Qi(fn.background.uniforms),vertexShader:fn.background.vertexShader,fragmentShader:fn.background.fragmentShader,side:zn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=E,l.material.uniforms.backgroundIntensity.value=y.backgroundIntensity,l.material.toneMapped=Xe.getTransfer(E.colorSpace)!==Ze,E.matrixAutoUpdate===!0&&E.updateMatrix(),l.material.uniforms.uvTransform.value.copy(E.matrix),(u!==E||h!==E.version||d!==r.toneMapping)&&(l.material.needsUpdate=!0,u=E,h=E.version,d=r.toneMapping),l.layers.enableAll(),v.unshift(l,l.geometry,l.material,0,0,null))}function m(v,y){v.getRGB(hs,Nu(r)),t.buffers.color.setClear(hs.r,hs.g,hs.b,y,s)}function p(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return a},setClearColor:function(v,y=1){a.set(v),o=y,m(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(v){o=v,m(a,o)},render:_,addToRenderList:g,dispose:p}}function c_(r,e){const t=r.getParameter(r.MAX_VERTEX_ATTRIBS),n={},i=d(null);let s=i,a=!1;function o(C,D,U,H,G){let B=!1;const z=h(C,H,U,D);s!==z&&(s=z,c(s.object)),B=f(C,H,U,G),B&&_(C,H,U,G),G!==null&&e.update(G,r.ELEMENT_ARRAY_BUFFER),(B||a)&&(a=!1,E(C,D,U,H),G!==null&&r.bindBuffer(r.ELEMENT_ARRAY_BUFFER,e.get(G).buffer))}function l(){return r.createVertexArray()}function c(C){return r.bindVertexArray(C)}function u(C){return r.deleteVertexArray(C)}function h(C,D,U,H){const G=H.wireframe===!0;let B=n[D.id];B===void 0&&(B={},n[D.id]=B);const z=C.isInstancedMesh===!0?C.id:0;let $=B[z];$===void 0&&($={},B[z]=$);let Y=$[U.id];Y===void 0&&(Y={},$[U.id]=Y);let ce=Y[G];return ce===void 0&&(ce=d(l()),Y[G]=ce),ce}function d(C){const D=[],U=[],H=[];for(let G=0;G<t;G++)D[G]=0,U[G]=0,H[G]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:D,enabledAttributes:U,attributeDivisors:H,object:C,attributes:{},index:null}}function f(C,D,U,H){const G=s.attributes,B=D.attributes;let z=0;const $=U.getAttributes();for(const Y in $)if($[Y].location>=0){const pe=G[Y];let de=B[Y];if(de===void 0&&(Y==="instanceMatrix"&&C.instanceMatrix&&(de=C.instanceMatrix),Y==="instanceColor"&&C.instanceColor&&(de=C.instanceColor)),pe===void 0||pe.attribute!==de||de&&pe.data!==de.data)return!0;z++}return s.attributesNum!==z||s.index!==H}function _(C,D,U,H){const G={},B=D.attributes;let z=0;const $=U.getAttributes();for(const Y in $)if($[Y].location>=0){let pe=B[Y];pe===void 0&&(Y==="instanceMatrix"&&C.instanceMatrix&&(pe=C.instanceMatrix),Y==="instanceColor"&&C.instanceColor&&(pe=C.instanceColor));const de={};de.attribute=pe,pe&&pe.data&&(de.data=pe.data),G[Y]=de,z++}s.attributes=G,s.attributesNum=z,s.index=H}function g(){const C=s.newAttributes;for(let D=0,U=C.length;D<U;D++)C[D]=0}function m(C){p(C,0)}function p(C,D){const U=s.newAttributes,H=s.enabledAttributes,G=s.attributeDivisors;U[C]=1,H[C]===0&&(r.enableVertexAttribArray(C),H[C]=1),G[C]!==D&&(r.vertexAttribDivisor(C,D),G[C]=D)}function v(){const C=s.newAttributes,D=s.enabledAttributes;for(let U=0,H=D.length;U<H;U++)D[U]!==C[U]&&(r.disableVertexAttribArray(U),D[U]=0)}function y(C,D,U,H,G,B,z){z===!0?r.vertexAttribIPointer(C,D,U,G,B):r.vertexAttribPointer(C,D,U,H,G,B)}function E(C,D,U,H){g();const G=H.attributes,B=U.getAttributes(),z=D.defaultAttributeValues;for(const $ in B){const Y=B[$];if(Y.location>=0){let ce=G[$];if(ce===void 0&&($==="instanceMatrix"&&C.instanceMatrix&&(ce=C.instanceMatrix),$==="instanceColor"&&C.instanceColor&&(ce=C.instanceColor)),ce!==void 0){const pe=ce.normalized,de=ce.itemSize,Fe=e.get(ce);if(Fe===void 0)continue;const ct=Fe.buffer,ot=Fe.type,j=Fe.bytesPerElement,ne=ot===r.INT||ot===r.UNSIGNED_INT||ce.gpuType===Uo;if(ce.isInterleavedBufferAttribute){const se=ce.data,De=se.stride,Re=ce.offset;if(se.isInstancedInterleavedBuffer){for(let we=0;we<Y.locationSize;we++)p(Y.location+we,se.meshPerAttribute);C.isInstancedMesh!==!0&&H._maxInstanceCount===void 0&&(H._maxInstanceCount=se.meshPerAttribute*se.count)}else for(let we=0;we<Y.locationSize;we++)m(Y.location+we);r.bindBuffer(r.ARRAY_BUFFER,ct);for(let we=0;we<Y.locationSize;we++)y(Y.location+we,de/Y.locationSize,ot,pe,De*j,(Re+de/Y.locationSize*we)*j,ne)}else{if(ce.isInstancedBufferAttribute){for(let se=0;se<Y.locationSize;se++)p(Y.location+se,ce.meshPerAttribute);C.isInstancedMesh!==!0&&H._maxInstanceCount===void 0&&(H._maxInstanceCount=ce.meshPerAttribute*ce.count)}else for(let se=0;se<Y.locationSize;se++)m(Y.location+se);r.bindBuffer(r.ARRAY_BUFFER,ct);for(let se=0;se<Y.locationSize;se++)y(Y.location+se,de/Y.locationSize,ot,pe,de*j,de/Y.locationSize*se*j,ne)}}else if(z!==void 0){const pe=z[$];if(pe!==void 0)switch(pe.length){case 2:r.vertexAttrib2fv(Y.location,pe);break;case 3:r.vertexAttrib3fv(Y.location,pe);break;case 4:r.vertexAttrib4fv(Y.location,pe);break;default:r.vertexAttrib1fv(Y.location,pe)}}}}v()}function R(){b();for(const C in n){const D=n[C];for(const U in D){const H=D[U];for(const G in H){const B=H[G];for(const z in B)u(B[z].object),delete B[z];delete H[G]}}delete n[C]}}function T(C){if(n[C.id]===void 0)return;const D=n[C.id];for(const U in D){const H=D[U];for(const G in H){const B=H[G];for(const z in B)u(B[z].object),delete B[z];delete H[G]}}delete n[C.id]}function L(C){for(const D in n){const U=n[D];for(const H in U){const G=U[H];if(G[C.id]===void 0)continue;const B=G[C.id];for(const z in B)u(B[z].object),delete B[z];delete G[C.id]}}}function x(C){for(const D in n){const U=n[D],H=C.isInstancedMesh===!0?C.id:0,G=U[H];if(G!==void 0){for(const B in G){const z=G[B];for(const $ in z)u(z[$].object),delete z[$];delete G[B]}delete U[H],Object.keys(U).length===0&&delete n[D]}}}function b(){V(),a=!0,s!==i&&(s=i,c(s.object))}function V(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:o,reset:b,resetDefaultState:V,dispose:R,releaseStatesOfGeometry:T,releaseStatesOfObject:x,releaseStatesOfProgram:L,initAttributes:g,enableAttribute:m,disableUnusedAttributes:v}}function u_(r,e,t){let n;function i(c){n=c}function s(c,u){r.drawArrays(n,c,u),t.update(u,n,1)}function a(c,u,h){h!==0&&(r.drawArraysInstanced(n,c,u,h),t.update(u,n,h))}function o(c,u,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,u,0,h);let f=0;for(let _=0;_<h;_++)f+=u[_];t.update(f,n,1)}function l(c,u,h,d){if(h===0)return;const f=e.get("WEBGL_multi_draw");if(f===null)for(let _=0;_<c.length;_++)a(c[_],u[_],d[_]);else{f.multiDrawArraysInstancedWEBGL(n,c,0,u,0,d,0,h);let _=0;for(let g=0;g<h;g++)_+=u[g]*d[g];t.update(_,n,1)}}this.setMode=i,this.render=s,this.renderInstances=a,this.renderMultiDraw=o,this.renderMultiDrawInstances=l}function d_(r,e,t,n){let i;function s(){if(i!==void 0)return i;if(e.has("EXT_texture_filter_anisotropic")===!0){const L=e.get("EXT_texture_filter_anisotropic");i=r.getParameter(L.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function a(L){return!(L!==Yt&&n.convert(L)!==r.getParameter(r.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(L){const x=L===Hn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(L!==Wt&&n.convert(L)!==r.getParameter(r.IMPLEMENTATION_COLOR_READ_TYPE)&&L!==Qt&&!x)}function l(L){if(L==="highp"){if(r.getShaderPrecisionFormat(r.VERTEX_SHADER,r.HIGH_FLOAT).precision>0&&r.getShaderPrecisionFormat(r.FRAGMENT_SHADER,r.HIGH_FLOAT).precision>0)return"highp";L="mediump"}return L==="mediump"&&r.getShaderPrecisionFormat(r.VERTEX_SHADER,r.MEDIUM_FLOAT).precision>0&&r.getShaderPrecisionFormat(r.FRAGMENT_SHADER,r.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp";const u=l(c);u!==c&&(ye("WebGLRenderer:",c,"not supported, using",u,"instead."),c=u);const h=t.logarithmicDepthBuffer===!0,d=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control"),f=r.getParameter(r.MAX_TEXTURE_IMAGE_UNITS),_=r.getParameter(r.MAX_VERTEX_TEXTURE_IMAGE_UNITS),g=r.getParameter(r.MAX_TEXTURE_SIZE),m=r.getParameter(r.MAX_CUBE_MAP_TEXTURE_SIZE),p=r.getParameter(r.MAX_VERTEX_ATTRIBS),v=r.getParameter(r.MAX_VERTEX_UNIFORM_VECTORS),y=r.getParameter(r.MAX_VARYING_VECTORS),E=r.getParameter(r.MAX_FRAGMENT_UNIFORM_VECTORS),R=r.getParameter(r.MAX_SAMPLES),T=r.getParameter(r.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:h,reversedDepthBuffer:d,maxTextures:f,maxVertexTextures:_,maxTextureSize:g,maxCubemapSize:m,maxAttributes:p,maxVertexUniforms:v,maxVaryings:y,maxFragmentUniforms:E,maxSamples:R,samples:T}}function h_(r){const e=this;let t=null,n=0,i=!1,s=!1;const a=new di,o=new Ue,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(h,d){const f=h.length!==0||d||n!==0||i;return i=d,n=h.length,f},this.beginShadows=function(){s=!0,u(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(h,d){t=u(h,d,0)},this.setState=function(h,d,f){const _=h.clippingPlanes,g=h.clipIntersection,m=h.clipShadows,p=r.get(h);if(!i||_===null||_.length===0||s&&!m)s?u(null):c();else{const v=s?0:n,y=v*4;let E=p.clippingState||null;l.value=E,E=u(_,d,y,f);for(let R=0;R!==y;++R)E[R]=t[R];p.clippingState=E,this.numIntersection=g?this.numPlanes:0,this.numPlanes+=v}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function u(h,d,f,_){const g=h!==null?h.length:0;let m=null;if(g!==0){if(m=l.value,_!==!0||m===null){const p=f+g*4,v=d.matrixWorldInverse;o.getNormalMatrix(v),(m===null||m.length<p)&&(m=new Float32Array(p));for(let y=0,E=f;y!==g;++y,E+=4)a.copy(h[y]).applyMatrix4(v,o),a.normal.toArray(m,E),m[E+3]=a.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=g,e.numIntersection=0,m}}const ei=4,fc=[.125,.215,.35,.446,.526,.582],fi=20,f_=256,fr=new Ns,pc=new Le;let xa=null,Sa=0,va=0,Ea=!1;const p_=new I;class mc{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,i=100,s={}){const{size:a=256,position:o=p_}=s;xa=this._renderer.getRenderTarget(),Sa=this._renderer.getActiveCubeFace(),va=this._renderer.getActiveMipmapLevel(),Ea=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);const l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,n,i,l,o),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Mc(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=gc(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(xa,Sa,va),this._renderer.xr.enabled=Ea,e.scissorTest=!1,ki(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===mi||e.mapping===Wi?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),xa=this._renderer.getRenderTarget(),Sa=this._renderer.getActiveCubeFace(),va=this._renderer.getActiveMipmapLevel(),Ea=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:vt,minFilter:vt,generateMipmaps:!1,type:Hn,format:Yt,colorSpace:Dt,depthBuffer:!1},i=_c(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=_c(e,t,n);const{_lodMax:s}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=m_(s)),this._blurMaterial=g_(s,e,t),this._ggxMaterial=__(s,e,t)}return i}_compileMaterial(e){const t=new wt(new Pt,e);this._renderer.compile(t,fr)}_sceneToCubeUV(e,t,n,i,s){const l=new kt(90,1,t,n),c=[1,-1,1,1,1,1],u=[1,1,1,-1,-1,-1],h=this._renderer,d=h.autoClear,f=h.toneMapping;h.getClearColor(pc),h.toneMapping=gn,h.autoClear=!1,h.state.buffers.depth.getReversed()&&(h.setRenderTarget(i),h.clearDepth(),h.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new wt(new Nr,new Dn({name:"PMREM.Background",side:zt,depthWrite:!1,depthTest:!1})));const g=this._backgroundBox,m=g.material;let p=!1;const v=e.background;v?v.isColor&&(m.color.copy(v),e.background=null,p=!0):(m.color.copy(pc),p=!0);for(let y=0;y<6;y++){const E=y%3;E===0?(l.up.set(0,c[y],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x+u[y],s.y,s.z)):E===1?(l.up.set(0,0,c[y]),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y+u[y],s.z)):(l.up.set(0,c[y],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y,s.z+u[y]));const R=this._cubeSize;ki(i,E*R,y>2?R:0,R,R),h.setRenderTarget(i),p&&h.render(g,l),h.render(e,l)}h.toneMapping=f,h.autoClear=d,e.background=v}_textureToCubeUV(e,t){const n=this._renderer,i=e.mapping===mi||e.mapping===Wi;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=Mc()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=gc());const s=i?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=s;const o=s.uniforms;o.envMap.value=e;const l=this._cubeSize;ki(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(a,fr)}_applyPMREM(e){const t=this._renderer,n=t.autoClear;t.autoClear=!1;const i=this._lodMeshes.length;for(let s=1;s<i;s++)this._applyGGXFilter(e,s-1,s);t.autoClear=n}_applyGGXFilter(e,t,n){const i=this._renderer,s=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;const l=a.uniforms,c=n/(this._lodMeshes.length-1),u=t/(this._lodMeshes.length-1),h=Math.sqrt(c*c-u*u),d=0+c*1.25,f=h*d,{_lodMax:_}=this,g=this._sizeLods[n],m=3*g*(n>_-ei?n-_+ei:0),p=4*(this._cubeSize-g);l.envMap.value=e.texture,l.roughness.value=f,l.mipInt.value=_-t,ki(s,m,p,3*g,2*g),i.setRenderTarget(s),i.render(o,fr),l.envMap.value=s.texture,l.roughness.value=0,l.mipInt.value=_-n,ki(e,m,p,3*g,2*g),i.setRenderTarget(e),i.render(o,fr)}_blur(e,t,n,i,s){const a=this._pingPongRenderTarget;this._halfBlur(e,a,t,n,i,"latitudinal",s),this._halfBlur(a,e,n,n,i,"longitudinal",s)}_halfBlur(e,t,n,i,s,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&Te("blur direction must be either latitudinal or longitudinal!");const u=3,h=this._lodMeshes[i];h.material=c;const d=c.uniforms,f=this._sizeLods[n]-1,_=isFinite(s)?Math.PI/(2*f):2*Math.PI/(2*fi-1),g=s/_,m=isFinite(s)?1+Math.floor(u*g):fi;m>fi&&ye(`sigmaRadians, ${s}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${fi}`);const p=[];let v=0;for(let L=0;L<fi;++L){const x=L/g,b=Math.exp(-x*x/2);p.push(b),L===0?v+=b:L<m&&(v+=2*b)}for(let L=0;L<p.length;L++)p[L]=p[L]/v;d.envMap.value=e.texture,d.samples.value=m,d.weights.value=p,d.latitudinal.value=a==="latitudinal",o&&(d.poleAxis.value=o);const{_lodMax:y}=this;d.dTheta.value=_,d.mipInt.value=y-n;const E=this._sizeLods[i],R=3*E*(i>y-ei?i-y+ei:0),T=4*(this._cubeSize-E);ki(t,R,T,3*E,2*E),l.setRenderTarget(t),l.render(h,fr)}}function m_(r){const e=[],t=[],n=[];let i=r;const s=r-ei+1+fc.length;for(let a=0;a<s;a++){const o=Math.pow(2,i);e.push(o);let l=1/o;a>r-ei?l=fc[a-r+ei-1]:a===0&&(l=0),t.push(l);const c=1/(o-2),u=-c,h=1+c,d=[u,u,h,u,h,h,u,u,h,h,u,h],f=6,_=6,g=3,m=2,p=1,v=new Float32Array(g*_*f),y=new Float32Array(m*_*f),E=new Float32Array(p*_*f);for(let T=0;T<f;T++){const L=T%3*2/3-1,x=T>2?0:-1,b=[L,x,0,L+2/3,x,0,L+2/3,x+1,0,L,x,0,L+2/3,x+1,0,L,x+1,0];v.set(b,g*_*T),y.set(d,m*_*T);const V=[T,T,T,T,T,T];E.set(V,p*_*T)}const R=new Pt;R.setAttribute("position",new Lt(v,g)),R.setAttribute("uv",new Lt(y,m)),R.setAttribute("faceIndex",new Lt(E,p)),n.push(new wt(R,null)),i>ei&&i--}return{lodMeshes:n,sizeLods:e,sigmas:t}}function _c(r,e,t){const n=new Mn(r,e,t);return n.texture.mapping=Ls,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function ki(r,e,t,n,i){r.viewport.set(e,t,n,i),r.scissor.set(e,t,n,i)}function __(r,e,t){return new Sn({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:f_,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${r}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Os(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:Bn,depthTest:!1,depthWrite:!1})}function g_(r,e,t){const n=new Float32Array(fi),i=new I(0,1,0);return new Sn({name:"SphericalGaussianBlur",defines:{n:fi,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${r}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:i}},vertexShader:Os(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Bn,depthTest:!1,depthWrite:!1})}function gc(){return new Sn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Os(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Bn,depthTest:!1,depthWrite:!1})}function Mc(){return new Sn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Os(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Bn,depthTest:!1,depthWrite:!1})}function Os(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}class ku extends Mn{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const n={width:e,height:e,depth:1},i=[n,n,n,n,n,n];this.texture=new Lu(i),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},i=new Nr(5,5,5),s=new Sn({name:"CubemapFromEquirect",uniforms:Qi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:zt,blending:Bn});s.uniforms.tEquirect.value=t;const a=new wt(i,s),o=t.minFilter;return t.minFilter===On&&(t.minFilter=vt),new mf(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,i=!0){const s=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,n,i);e.setRenderTarget(s)}}function M_(r){let e=new WeakMap,t=new WeakMap,n=null;function i(d,f=!1){return d==null?null:f?a(d):s(d)}function s(d){if(d&&d.isTexture){const f=d.mapping;if(f===Gs||f===Vs)if(e.has(d)){const _=e.get(d).texture;return o(_,d.mapping)}else{const _=d.image;if(_&&_.height>0){const g=new ku(_.height);return g.fromEquirectangularTexture(r,d),e.set(d,g),d.addEventListener("dispose",c),o(g.texture,d.mapping)}else return null}}return d}function a(d){if(d&&d.isTexture){const f=d.mapping,_=f===Gs||f===Vs,g=f===mi||f===Wi;if(_||g){let m=t.get(d);const p=m!==void 0?m.texture.pmremVersion:0;if(d.isRenderTargetTexture&&d.pmremVersion!==p)return n===null&&(n=new mc(r)),m=_?n.fromEquirectangular(d,m):n.fromCubemap(d,m),m.texture.pmremVersion=d.pmremVersion,t.set(d,m),m.texture;if(m!==void 0)return m.texture;{const v=d.image;return _&&v&&v.height>0||g&&v&&l(v)?(n===null&&(n=new mc(r)),m=_?n.fromEquirectangular(d):n.fromCubemap(d),m.texture.pmremVersion=d.pmremVersion,t.set(d,m),d.addEventListener("dispose",u),m.texture):null}}}return d}function o(d,f){return f===Gs?d.mapping=mi:f===Vs&&(d.mapping=Wi),d}function l(d){let f=0;const _=6;for(let g=0;g<_;g++)d[g]!==void 0&&f++;return f===_}function c(d){const f=d.target;f.removeEventListener("dispose",c);const _=e.get(f);_!==void 0&&(e.delete(f),_.dispose())}function u(d){const f=d.target;f.removeEventListener("dispose",u);const _=t.get(f);_!==void 0&&(t.delete(f),_.dispose())}function h(){e=new WeakMap,t=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:i,dispose:h}}function x_(r){const e={};function t(n){if(e[n]!==void 0)return e[n];const i=r.getExtension(n);return e[n]=i,i}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){const i=t(n);return i===null&&bs("WebGLRenderer: "+n+" extension not supported."),i}}}function S_(r,e,t,n){const i={},s=new WeakMap;function a(h){const d=h.target;d.index!==null&&e.remove(d.index);for(const _ in d.attributes)e.remove(d.attributes[_]);d.removeEventListener("dispose",a),delete i[d.id];const f=s.get(d);f&&(e.remove(f),s.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function o(h,d){return i[d.id]===!0||(d.addEventListener("dispose",a),i[d.id]=!0,t.memory.geometries++),d}function l(h){const d=h.attributes;for(const f in d)e.update(d[f],r.ARRAY_BUFFER)}function c(h){const d=[],f=h.index,_=h.attributes.position;let g=0;if(_===void 0)return;if(f!==null){const v=f.array;g=f.version;for(let y=0,E=v.length;y<E;y+=3){const R=v[y+0],T=v[y+1],L=v[y+2];d.push(R,T,T,L,L,R)}}else{const v=_.array;g=_.version;for(let y=0,E=v.length/3-1;y<E;y+=3){const R=y+0,T=y+1,L=y+2;d.push(R,T,T,L,L,R)}}const m=new(_.count>=65535?bu:yu)(d,1);m.version=g;const p=s.get(h);p&&e.remove(p),s.set(h,m)}function u(h){const d=s.get(h);if(d){const f=h.index;f!==null&&d.version<f.version&&c(h)}else c(h);return s.get(h)}return{get:o,update:l,getWireframeAttribute:u}}function v_(r,e,t){let n;function i(d){n=d}let s,a;function o(d){s=d.type,a=d.bytesPerElement}function l(d,f){r.drawElements(n,f,s,d*a),t.update(f,n,1)}function c(d,f,_){_!==0&&(r.drawElementsInstanced(n,f,s,d*a,_),t.update(f,n,_))}function u(d,f,_){if(_===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,f,0,s,d,0,_);let m=0;for(let p=0;p<_;p++)m+=f[p];t.update(m,n,1)}function h(d,f,_,g){if(_===0)return;const m=e.get("WEBGL_multi_draw");if(m===null)for(let p=0;p<d.length;p++)c(d[p]/a,f[p],g[p]);else{m.multiDrawElementsInstancedWEBGL(n,f,0,s,d,0,g,0,_);let p=0;for(let v=0;v<_;v++)p+=f[v]*g[v];t.update(p,n,1)}}this.setMode=i,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=u,this.renderMultiDrawInstances=h}function E_(r){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(s,a,o){switch(t.calls++,a){case r.TRIANGLES:t.triangles+=o*(s/3);break;case r.LINES:t.lines+=o*(s/2);break;case r.LINE_STRIP:t.lines+=o*(s-1);break;case r.LINE_LOOP:t.lines+=o*s;break;case r.POINTS:t.points+=o*s;break;default:Te("WebGLInfo: Unknown draw mode:",a);break}}function i(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:i,update:n}}function y_(r,e,t){const n=new WeakMap,i=new lt;function s(a,o,l){const c=a.morphTargetInfluences,u=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,h=u!==void 0?u.length:0;let d=n.get(o);if(d===void 0||d.count!==h){let b=function(){L.dispose(),n.delete(o),o.removeEventListener("dispose",b)};d!==void 0&&d.texture.dispose();const f=o.morphAttributes.position!==void 0,_=o.morphAttributes.normal!==void 0,g=o.morphAttributes.color!==void 0,m=o.morphAttributes.position||[],p=o.morphAttributes.normal||[],v=o.morphAttributes.color||[];let y=0;f===!0&&(y=1),_===!0&&(y=2),g===!0&&(y=3);let E=o.attributes.position.count*y,R=1;E>e.maxTextureSize&&(R=Math.ceil(E/e.maxTextureSize),E=e.maxTextureSize);const T=new Float32Array(E*R*4*h),L=new vu(T,E,R,h);L.type=Qt,L.needsUpdate=!0;const x=y*4;for(let V=0;V<h;V++){const C=m[V],D=p[V],U=v[V],H=E*R*4*V;for(let G=0;G<C.count;G++){const B=G*x;f===!0&&(i.fromBufferAttribute(C,G),T[H+B+0]=i.x,T[H+B+1]=i.y,T[H+B+2]=i.z,T[H+B+3]=0),_===!0&&(i.fromBufferAttribute(D,G),T[H+B+4]=i.x,T[H+B+5]=i.y,T[H+B+6]=i.z,T[H+B+7]=0),g===!0&&(i.fromBufferAttribute(U,G),T[H+B+8]=i.x,T[H+B+9]=i.y,T[H+B+10]=i.z,T[H+B+11]=U.itemSize===4?i.w:1)}}d={count:h,texture:L,size:new Ie(E,R)},n.set(o,d),o.addEventListener("dispose",b)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(r,"morphTexture",a.morphTexture,t);else{let f=0;for(let g=0;g<c.length;g++)f+=c[g];const _=o.morphTargetsRelative?1:1-f;l.getUniforms().setValue(r,"morphTargetBaseInfluence",_),l.getUniforms().setValue(r,"morphTargetInfluences",c)}l.getUniforms().setValue(r,"morphTargetsTexture",d.texture,t),l.getUniforms().setValue(r,"morphTargetsTextureSize",d.size)}return{update:s}}function b_(r,e,t,n,i){let s=new WeakMap;function a(c){const u=i.render.frame,h=c.geometry,d=e.get(c,h);if(s.get(d)!==u&&(e.update(d),s.set(d,u)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),s.get(c)!==u&&(t.update(c.instanceMatrix,r.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,r.ARRAY_BUFFER),s.set(c,u))),c.isSkinnedMesh){const f=c.skeleton;s.get(f)!==u&&(f.update(),s.set(f,u))}return d}function o(){s=new WeakMap}function l(c){const u=c.target;u.removeEventListener("dispose",l),n.releaseStatesOfObject(u),t.remove(u.instanceMatrix),u.instanceColor!==null&&t.remove(u.instanceColor)}return{update:a,dispose:o}}const A_={[ru]:"LINEAR_TONE_MAPPING",[su]:"REINHARD_TONE_MAPPING",[au]:"CINEON_TONE_MAPPING",[ou]:"ACES_FILMIC_TONE_MAPPING",[cu]:"AGX_TONE_MAPPING",[uu]:"NEUTRAL_TONE_MAPPING",[lu]:"CUSTOM_TONE_MAPPING"};function T_(r,e,t,n,i){const s=new Mn(e,t,{type:r,depthBuffer:n,stencilBuffer:i}),a=new Mn(e,t,{type:Hn,depthBuffer:!1,stencilBuffer:!1}),o=new Pt;o.setAttribute("position",new mt([-1,3,0,-1,-1,0,3,-1,0],3)),o.setAttribute("uv",new mt([0,2,0,0,2,0],2));const l=new Xh({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),c=new wt(o,l),u=new Ns(-1,1,1,-1,0,1);let h=null,d=null,f=!1,_,g=null,m=[],p=!1;this.setSize=function(v,y){s.setSize(v,y),a.setSize(v,y);for(let E=0;E<m.length;E++){const R=m[E];R.setSize&&R.setSize(v,y)}},this.setEffects=function(v){m=v,p=m.length>0&&m[0].isRenderPass===!0;const y=s.width,E=s.height;for(let R=0;R<m.length;R++){const T=m[R];T.setSize&&T.setSize(y,E)}},this.begin=function(v,y){if(f||v.toneMapping===gn&&m.length===0)return!1;if(g=y,y!==null){const E=y.width,R=y.height;(s.width!==E||s.height!==R)&&this.setSize(E,R)}return p===!1&&v.setRenderTarget(s),_=v.toneMapping,v.toneMapping=gn,!0},this.hasRenderPass=function(){return p},this.end=function(v,y){v.toneMapping=_,f=!0;let E=s,R=a;for(let T=0;T<m.length;T++){const L=m[T];if(L.enabled!==!1&&(L.render(v,R,E,y),L.needsSwap!==!1)){const x=E;E=R,R=x}}if(h!==v.outputColorSpace||d!==v.toneMapping){h=v.outputColorSpace,d=v.toneMapping,l.defines={},Xe.getTransfer(h)===Ze&&(l.defines.SRGB_TRANSFER="");const T=A_[d];T&&(l.defines[T]=""),l.needsUpdate=!0}l.uniforms.tDiffuse.value=E.texture,v.setRenderTarget(g),v.render(c,u),g=null,f=!1},this.isCompositing=function(){return f},this.dispose=function(){s.dispose(),a.dispose(),o.dispose(),l.dispose()}}const zu=new Et,To=new wr(1,1),Hu=new vu,Gu=new ph,Vu=new Lu,xc=[],Sc=[],vc=new Float32Array(16),Ec=new Float32Array(9),yc=new Float32Array(4);function nr(r,e,t){const n=r[0];if(n<=0||n>0)return r;const i=e*t;let s=xc[i];if(s===void 0&&(s=new Float32Array(i),xc[i]=s),e!==0){n.toArray(s,0);for(let a=1,o=0;a!==e;++a)o+=t,r[a].toArray(s,o)}return s}function yt(r,e){if(r.length!==e.length)return!1;for(let t=0,n=r.length;t<n;t++)if(r[t]!==e[t])return!1;return!0}function bt(r,e){for(let t=0,n=e.length;t<n;t++)r[t]=e[t]}function Ds(r,e){let t=Sc[e];t===void 0&&(t=new Int32Array(e),Sc[e]=t);for(let n=0;n!==e;++n)t[n]=r.allocateTextureUnit();return t}function R_(r,e){const t=this.cache;t[0]!==e&&(r.uniform1f(this.addr,e),t[0]=e)}function C_(r,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(r.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(yt(t,e))return;r.uniform2fv(this.addr,e),bt(t,e)}}function L_(r,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(r.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(r.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(yt(t,e))return;r.uniform3fv(this.addr,e),bt(t,e)}}function w_(r,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(r.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(yt(t,e))return;r.uniform4fv(this.addr,e),bt(t,e)}}function P_(r,e){const t=this.cache,n=e.elements;if(n===void 0){if(yt(t,e))return;r.uniformMatrix2fv(this.addr,!1,e),bt(t,e)}else{if(yt(t,n))return;yc.set(n),r.uniformMatrix2fv(this.addr,!1,yc),bt(t,n)}}function I_(r,e){const t=this.cache,n=e.elements;if(n===void 0){if(yt(t,e))return;r.uniformMatrix3fv(this.addr,!1,e),bt(t,e)}else{if(yt(t,n))return;Ec.set(n),r.uniformMatrix3fv(this.addr,!1,Ec),bt(t,n)}}function N_(r,e){const t=this.cache,n=e.elements;if(n===void 0){if(yt(t,e))return;r.uniformMatrix4fv(this.addr,!1,e),bt(t,e)}else{if(yt(t,n))return;vc.set(n),r.uniformMatrix4fv(this.addr,!1,vc),bt(t,n)}}function O_(r,e){const t=this.cache;t[0]!==e&&(r.uniform1i(this.addr,e),t[0]=e)}function D_(r,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(r.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(yt(t,e))return;r.uniform2iv(this.addr,e),bt(t,e)}}function U_(r,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(r.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(yt(t,e))return;r.uniform3iv(this.addr,e),bt(t,e)}}function F_(r,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(r.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(yt(t,e))return;r.uniform4iv(this.addr,e),bt(t,e)}}function B_(r,e){const t=this.cache;t[0]!==e&&(r.uniform1ui(this.addr,e),t[0]=e)}function k_(r,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(r.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(yt(t,e))return;r.uniform2uiv(this.addr,e),bt(t,e)}}function z_(r,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(r.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(yt(t,e))return;r.uniform3uiv(this.addr,e),bt(t,e)}}function H_(r,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(r.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(yt(t,e))return;r.uniform4uiv(this.addr,e),bt(t,e)}}function G_(r,e,t){const n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i);let s;this.type===r.SAMPLER_2D_SHADOW?(To.compareFunction=t.isReversedDepthBuffer()?Xo:Wo,s=To):s=zu,t.setTexture2D(e||s,i)}function V_(r,e,t){const n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),t.setTexture3D(e||Gu,i)}function W_(r,e,t){const n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),t.setTextureCube(e||Vu,i)}function X_(r,e,t){const n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),t.setTexture2DArray(e||Hu,i)}function K_(r){switch(r){case 5126:return R_;case 35664:return C_;case 35665:return L_;case 35666:return w_;case 35674:return P_;case 35675:return I_;case 35676:return N_;case 5124:case 35670:return O_;case 35667:case 35671:return D_;case 35668:case 35672:return U_;case 35669:case 35673:return F_;case 5125:return B_;case 36294:return k_;case 36295:return z_;case 36296:return H_;case 35678:case 36198:case 36298:case 36306:case 35682:return G_;case 35679:case 36299:case 36307:return V_;case 35680:case 36300:case 36308:case 36293:return W_;case 36289:case 36303:case 36311:case 36292:return X_}}function q_(r,e){r.uniform1fv(this.addr,e)}function j_(r,e){const t=nr(e,this.size,2);r.uniform2fv(this.addr,t)}function Q_(r,e){const t=nr(e,this.size,3);r.uniform3fv(this.addr,t)}function Y_(r,e){const t=nr(e,this.size,4);r.uniform4fv(this.addr,t)}function Z_(r,e){const t=nr(e,this.size,4);r.uniformMatrix2fv(this.addr,!1,t)}function J_(r,e){const t=nr(e,this.size,9);r.uniformMatrix3fv(this.addr,!1,t)}function $_(r,e){const t=nr(e,this.size,16);r.uniformMatrix4fv(this.addr,!1,t)}function e0(r,e){r.uniform1iv(this.addr,e)}function t0(r,e){r.uniform2iv(this.addr,e)}function n0(r,e){r.uniform3iv(this.addr,e)}function i0(r,e){r.uniform4iv(this.addr,e)}function r0(r,e){r.uniform1uiv(this.addr,e)}function s0(r,e){r.uniform2uiv(this.addr,e)}function a0(r,e){r.uniform3uiv(this.addr,e)}function o0(r,e){r.uniform4uiv(this.addr,e)}function l0(r,e,t){const n=this.cache,i=e.length,s=Ds(t,i);yt(n,s)||(r.uniform1iv(this.addr,s),bt(n,s));let a;this.type===r.SAMPLER_2D_SHADOW?a=To:a=zu;for(let o=0;o!==i;++o)t.setTexture2D(e[o]||a,s[o])}function c0(r,e,t){const n=this.cache,i=e.length,s=Ds(t,i);yt(n,s)||(r.uniform1iv(this.addr,s),bt(n,s));for(let a=0;a!==i;++a)t.setTexture3D(e[a]||Gu,s[a])}function u0(r,e,t){const n=this.cache,i=e.length,s=Ds(t,i);yt(n,s)||(r.uniform1iv(this.addr,s),bt(n,s));for(let a=0;a!==i;++a)t.setTextureCube(e[a]||Vu,s[a])}function d0(r,e,t){const n=this.cache,i=e.length,s=Ds(t,i);yt(n,s)||(r.uniform1iv(this.addr,s),bt(n,s));for(let a=0;a!==i;++a)t.setTexture2DArray(e[a]||Hu,s[a])}function h0(r){switch(r){case 5126:return q_;case 35664:return j_;case 35665:return Q_;case 35666:return Y_;case 35674:return Z_;case 35675:return J_;case 35676:return $_;case 5124:case 35670:return e0;case 35667:case 35671:return t0;case 35668:case 35672:return n0;case 35669:case 35673:return i0;case 5125:return r0;case 36294:return s0;case 36295:return a0;case 36296:return o0;case 35678:case 36198:case 36298:case 36306:case 35682:return l0;case 35679:case 36299:case 36307:return c0;case 35680:case 36300:case 36308:case 36293:return u0;case 36289:case 36303:case 36311:case 36292:return d0}}class f0{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=K_(t.type)}}class p0{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=h0(t.type)}}class m0{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){const i=this.seq;for(let s=0,a=i.length;s!==a;++s){const o=i[s];o.setValue(e,t[o.id],n)}}}const ya=/(\w+)(\])?(\[|\.)?/g;function bc(r,e){r.seq.push(e),r.map[e.id]=e}function _0(r,e,t){const n=r.name,i=n.length;for(ya.lastIndex=0;;){const s=ya.exec(n),a=ya.lastIndex;let o=s[1];const l=s[2]==="]",c=s[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===i){bc(t,c===void 0?new f0(o,r,e):new p0(o,r,e));break}else{let h=t.map[o];h===void 0&&(h=new m0(o),bc(t,h)),t=h}}}class Ss{constructor(e,t){this.seq=[],this.map={};const n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let a=0;a<n;++a){const o=e.getActiveUniform(t,a),l=e.getUniformLocation(t,o.name);_0(o,l,this)}const i=[],s=[];for(const a of this.seq)a.type===e.SAMPLER_2D_SHADOW||a.type===e.SAMPLER_CUBE_SHADOW||a.type===e.SAMPLER_2D_ARRAY_SHADOW?i.push(a):s.push(a);i.length>0&&(this.seq=i.concat(s))}setValue(e,t,n,i){const s=this.map[t];s!==void 0&&s.setValue(e,n,i)}setOptional(e,t,n){const i=t[n];i!==void 0&&this.setValue(e,n,i)}static upload(e,t,n,i){for(let s=0,a=t.length;s!==a;++s){const o=t[s],l=n[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,i)}}static seqWithValue(e,t){const n=[];for(let i=0,s=e.length;i!==s;++i){const a=e[i];a.id in t&&n.push(a)}return n}}function Ac(r,e,t){const n=r.createShader(e);return r.shaderSource(n,t),r.compileShader(n),n}const g0=37297;let M0=0;function x0(r,e){const t=r.split(`
`),n=[],i=Math.max(e-6,0),s=Math.min(e+6,t.length);for(let a=i;a<s;a++){const o=a+1;n.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return n.join(`
`)}const Tc=new Ue;function S0(r){Xe._getMatrix(Tc,Xe.workingColorSpace,r);const e=`mat3( ${Tc.elements.map(t=>t.toFixed(4))} )`;switch(Xe.getTransfer(r)){case Es:return[e,"LinearTransferOETF"];case Ze:return[e,"sRGBTransferOETF"];default:return ye("WebGLProgram: Unsupported color space: ",r),[e,"LinearTransferOETF"]}}function Rc(r,e,t){const n=r.getShaderParameter(e,r.COMPILE_STATUS),s=(r.getShaderInfoLog(e)||"").trim();if(n&&s==="")return"";const a=/ERROR: 0:(\d+)/.exec(s);if(a){const o=parseInt(a[1]);return t.toUpperCase()+`

`+s+`

`+x0(r.getShaderSource(e),o)}else return s}function v0(r,e){const t=S0(e);return[`vec4 ${r}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}const E0={[ru]:"Linear",[su]:"Reinhard",[au]:"Cineon",[ou]:"ACESFilmic",[cu]:"AgX",[uu]:"Neutral",[lu]:"Custom"};function y0(r,e){const t=E0[e];return t===void 0?(ye("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+r+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+r+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const fs=new I;function b0(){Xe.getLuminanceCoefficients(fs);const r=fs.x.toFixed(4),e=fs.y.toFixed(4),t=fs.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${r}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function A0(r){return[r.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",r.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(xr).join(`
`)}function T0(r){const e=[];for(const t in r){const n=r[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function R0(r,e){const t={},n=r.getProgramParameter(e,r.ACTIVE_ATTRIBUTES);for(let i=0;i<n;i++){const s=r.getActiveAttrib(e,i),a=s.name;let o=1;s.type===r.FLOAT_MAT2&&(o=2),s.type===r.FLOAT_MAT3&&(o=3),s.type===r.FLOAT_MAT4&&(o=4),t[a]={type:s.type,location:r.getAttribLocation(e,a),locationSize:o}}return t}function xr(r){return r!==""}function Cc(r,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return r.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function Lc(r,e){return r.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const C0=/^[ \t]*#include +<([\w\d./]+)>/gm;function Ro(r){return r.replace(C0,w0)}const L0=new Map;function w0(r,e){let t=Be[e];if(t===void 0){const n=L0.get(e);if(n!==void 0)t=Be[n],ye('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("Can not resolve #include <"+e+">")}return Ro(t)}const P0=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function wc(r){return r.replace(P0,I0)}function I0(r,e,t,n){let i="";for(let s=parseInt(e);s<parseInt(t);s++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return i}function Pc(r){let e=`precision ${r.precision} float;
	precision ${r.precision} int;
	precision ${r.precision} sampler2D;
	precision ${r.precision} samplerCube;
	precision ${r.precision} sampler3D;
	precision ${r.precision} sampler2DArray;
	precision ${r.precision} sampler2DShadow;
	precision ${r.precision} samplerCubeShadow;
	precision ${r.precision} sampler2DArrayShadow;
	precision ${r.precision} isampler2D;
	precision ${r.precision} isampler3D;
	precision ${r.precision} isamplerCube;
	precision ${r.precision} isampler2DArray;
	precision ${r.precision} usampler2D;
	precision ${r.precision} usampler3D;
	precision ${r.precision} usamplerCube;
	precision ${r.precision} usampler2DArray;
	`;return r.precision==="highp"?e+=`
#define HIGH_PRECISION`:r.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:r.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}const N0={[ps]:"SHADOWMAP_TYPE_PCF",[gr]:"SHADOWMAP_TYPE_VSM"};function O0(r){return N0[r.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}const D0={[mi]:"ENVMAP_TYPE_CUBE",[Wi]:"ENVMAP_TYPE_CUBE",[Ls]:"ENVMAP_TYPE_CUBE_UV"};function U0(r){return r.envMap===!1?"ENVMAP_TYPE_CUBE":D0[r.envMapMode]||"ENVMAP_TYPE_CUBE"}const F0={[Wi]:"ENVMAP_MODE_REFRACTION"};function B0(r){return r.envMap===!1?"ENVMAP_MODE_REFLECTION":F0[r.envMapMode]||"ENVMAP_MODE_REFLECTION"}const k0={[Do]:"ENVMAP_BLENDING_MULTIPLY",[Cd]:"ENVMAP_BLENDING_MIX",[Ld]:"ENVMAP_BLENDING_ADD"};function z0(r){return r.envMap===!1?"ENVMAP_BLENDING_NONE":k0[r.combine]||"ENVMAP_BLENDING_NONE"}function H0(r){const e=r.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:n,maxMip:t}}function G0(r,e,t,n){const i=r.getContext(),s=t.defines;let a=t.vertexShader,o=t.fragmentShader;const l=O0(t),c=U0(t),u=B0(t),h=z0(t),d=H0(t),f=A0(t),_=T0(s),g=i.createProgram();let m,p,v=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_].filter(xr).join(`
`),m.length>0&&(m+=`
`),p=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_].filter(xr).join(`
`),p.length>0&&(p+=`
`)):(m=[Pc(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+u:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(xr).join(`
`),p=[Pc(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+u:"",t.envMap?"#define "+h:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==gn?"#define TONE_MAPPING":"",t.toneMapping!==gn?Be.tonemapping_pars_fragment:"",t.toneMapping!==gn?y0("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Be.colorspace_pars_fragment,v0("linearToOutputTexel",t.outputColorSpace),b0(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(xr).join(`
`)),a=Ro(a),a=Cc(a,t),a=Lc(a,t),o=Ro(o),o=Cc(o,t),o=Lc(o,t),a=wc(a),o=wc(o),t.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,m=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,p=["#define varying in",t.glslVersion===Al?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Al?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);const y=v+m+a,E=v+p+o,R=Ac(i,i.VERTEX_SHADER,y),T=Ac(i,i.FRAGMENT_SHADER,E);i.attachShader(g,R),i.attachShader(g,T),t.index0AttributeName!==void 0?i.bindAttribLocation(g,0,t.index0AttributeName):t.morphTargets===!0&&i.bindAttribLocation(g,0,"position"),i.linkProgram(g);function L(C){if(r.debug.checkShaderErrors){const D=i.getProgramInfoLog(g)||"",U=i.getShaderInfoLog(R)||"",H=i.getShaderInfoLog(T)||"",G=D.trim(),B=U.trim(),z=H.trim();let $=!0,Y=!0;if(i.getProgramParameter(g,i.LINK_STATUS)===!1)if($=!1,typeof r.debug.onShaderError=="function")r.debug.onShaderError(i,g,R,T);else{const ce=Rc(i,R,"vertex"),pe=Rc(i,T,"fragment");Te("THREE.WebGLProgram: Shader Error "+i.getError()+" - VALIDATE_STATUS "+i.getProgramParameter(g,i.VALIDATE_STATUS)+`

Material Name: `+C.name+`
Material Type: `+C.type+`

Program Info Log: `+G+`
`+ce+`
`+pe)}else G!==""?ye("WebGLProgram: Program Info Log:",G):(B===""||z==="")&&(Y=!1);Y&&(C.diagnostics={runnable:$,programLog:G,vertexShader:{log:B,prefix:m},fragmentShader:{log:z,prefix:p}})}i.deleteShader(R),i.deleteShader(T),x=new Ss(i,g),b=R0(i,g)}let x;this.getUniforms=function(){return x===void 0&&L(this),x};let b;this.getAttributes=function(){return b===void 0&&L(this),b};let V=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return V===!1&&(V=i.getProgramParameter(g,g0)),V},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(g),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=M0++,this.cacheKey=e,this.usedTimes=1,this.program=g,this.vertexShader=R,this.fragmentShader=T,this}let V0=0;class W0{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){const t=e.vertexShader,n=e.fragmentShader,i=this._getShaderStage(t),s=this._getShaderStage(n),a=this._getShaderCacheForMaterial(e);return a.has(i)===!1&&(a.add(i),i.usedTimes++),a.has(s)===!1&&(a.add(s),s.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){const t=this.shaderCache;let n=t.get(e);return n===void 0&&(n=new X0(e),t.set(e,n)),n}}class X0{constructor(e){this.id=V0++,this.code=e,this.usedTimes=0}}function K0(r,e,t,n,i,s){const a=new jo,o=new W0,l=new Set,c=[],u=new Map,h=n.logarithmicDepthBuffer;let d=n.precision;const f={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(x){return l.add(x),x===0?"uv":`uv${x}`}function g(x,b,V,C,D){const U=C.fog,H=D.geometry,G=x.isMeshStandardMaterial||x.isMeshLambertMaterial||x.isMeshPhongMaterial?C.environment:null,B=x.isMeshStandardMaterial||x.isMeshLambertMaterial&&!x.envMap||x.isMeshPhongMaterial&&!x.envMap,z=e.get(x.envMap||G,B),$=z&&z.mapping===Ls?z.image.height:null,Y=f[x.type];x.precision!==null&&(d=n.getMaxPrecision(x.precision),d!==x.precision&&ye("WebGLProgram.getParameters:",x.precision,"not supported, using",d,"instead."));const ce=H.morphAttributes.position||H.morphAttributes.normal||H.morphAttributes.color,pe=ce!==void 0?ce.length:0;let de=0;H.morphAttributes.position!==void 0&&(de=1),H.morphAttributes.normal!==void 0&&(de=2),H.morphAttributes.color!==void 0&&(de=3);let Fe,ct,ot,j;if(Y){const Ye=fn[Y];Fe=Ye.vertexShader,ct=Ye.fragmentShader}else Fe=x.vertexShader,ct=x.fragmentShader,o.update(x),ot=o.getVertexShaderID(x),j=o.getFragmentShaderID(x);const ne=r.getRenderTarget(),se=r.state.buffers.depth.getReversed(),De=D.isInstancedMesh===!0,Re=D.isBatchedMesh===!0,we=!!x.map,At=!!x.matcap,Ke=!!z,Qe=!!x.aoMap,nt=!!x.lightMap,ke=!!x.bumpMap,ft=!!x.normalMap,w=!!x.displacementMap,gt=!!x.emissiveMap,je=!!x.metalnessMap,rt=!!x.roughnessMap,Se=x.anisotropy>0,A=x.clearcoat>0,M=x.dispersion>0,N=x.iridescence>0,q=x.sheen>0,Q=x.transmission>0,K=Se&&!!x.anisotropyMap,me=A&&!!x.clearcoatMap,ie=A&&!!x.clearcoatNormalMap,Ae=A&&!!x.clearcoatRoughnessMap,Ce=N&&!!x.iridescenceMap,Z=N&&!!x.iridescenceThicknessMap,ee=q&&!!x.sheenColorMap,_e=q&&!!x.sheenRoughnessMap,Me=!!x.specularMap,ue=!!x.specularColorMap,ze=!!x.specularIntensityMap,P=Q&&!!x.transmissionMap,re=Q&&!!x.thicknessMap,te=!!x.gradientMap,fe=!!x.alphaMap,J=x.alphaTest>0,X=!!x.alphaHash,ge=!!x.extensions;let Pe=gn;x.toneMapped&&(ne===null||ne.isXRRenderTarget===!0)&&(Pe=r.toneMapping);const st={shaderID:Y,shaderType:x.type,shaderName:x.name,vertexShader:Fe,fragmentShader:ct,defines:x.defines,customVertexShaderID:ot,customFragmentShaderID:j,isRawShaderMaterial:x.isRawShaderMaterial===!0,glslVersion:x.glslVersion,precision:d,batching:Re,batchingColor:Re&&D._colorsTexture!==null,instancing:De,instancingColor:De&&D.instanceColor!==null,instancingMorph:De&&D.morphTexture!==null,outputColorSpace:ne===null?r.outputColorSpace:ne.isXRRenderTarget===!0?ne.texture.colorSpace:Dt,alphaToCoverage:!!x.alphaToCoverage,map:we,matcap:At,envMap:Ke,envMapMode:Ke&&z.mapping,envMapCubeUVHeight:$,aoMap:Qe,lightMap:nt,bumpMap:ke,normalMap:ft,displacementMap:w,emissiveMap:gt,normalMapObjectSpace:ft&&x.normalMapType===Od,normalMapTangentSpace:ft&&x.normalMapType===Vo,metalnessMap:je,roughnessMap:rt,anisotropy:Se,anisotropyMap:K,clearcoat:A,clearcoatMap:me,clearcoatNormalMap:ie,clearcoatRoughnessMap:Ae,dispersion:M,iridescence:N,iridescenceMap:Ce,iridescenceThicknessMap:Z,sheen:q,sheenColorMap:ee,sheenRoughnessMap:_e,specularMap:Me,specularColorMap:ue,specularIntensityMap:ze,transmission:Q,transmissionMap:P,thicknessMap:re,gradientMap:te,opaque:x.transparent===!1&&x.blending===zi&&x.alphaToCoverage===!1,alphaMap:fe,alphaTest:J,alphaHash:X,combine:x.combine,mapUv:we&&_(x.map.channel),aoMapUv:Qe&&_(x.aoMap.channel),lightMapUv:nt&&_(x.lightMap.channel),bumpMapUv:ke&&_(x.bumpMap.channel),normalMapUv:ft&&_(x.normalMap.channel),displacementMapUv:w&&_(x.displacementMap.channel),emissiveMapUv:gt&&_(x.emissiveMap.channel),metalnessMapUv:je&&_(x.metalnessMap.channel),roughnessMapUv:rt&&_(x.roughnessMap.channel),anisotropyMapUv:K&&_(x.anisotropyMap.channel),clearcoatMapUv:me&&_(x.clearcoatMap.channel),clearcoatNormalMapUv:ie&&_(x.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Ae&&_(x.clearcoatRoughnessMap.channel),iridescenceMapUv:Ce&&_(x.iridescenceMap.channel),iridescenceThicknessMapUv:Z&&_(x.iridescenceThicknessMap.channel),sheenColorMapUv:ee&&_(x.sheenColorMap.channel),sheenRoughnessMapUv:_e&&_(x.sheenRoughnessMap.channel),specularMapUv:Me&&_(x.specularMap.channel),specularColorMapUv:ue&&_(x.specularColorMap.channel),specularIntensityMapUv:ze&&_(x.specularIntensityMap.channel),transmissionMapUv:P&&_(x.transmissionMap.channel),thicknessMapUv:re&&_(x.thicknessMap.channel),alphaMapUv:fe&&_(x.alphaMap.channel),vertexTangents:!!H.attributes.tangent&&(ft||Se),vertexColors:x.vertexColors,vertexAlphas:x.vertexColors===!0&&!!H.attributes.color&&H.attributes.color.itemSize===4,pointsUvs:D.isPoints===!0&&!!H.attributes.uv&&(we||fe),fog:!!U,useFog:x.fog===!0,fogExp2:!!U&&U.isFogExp2,flatShading:x.wireframe===!1&&(x.flatShading===!0||H.attributes.normal===void 0&&ft===!1&&(x.isMeshLambertMaterial||x.isMeshPhongMaterial||x.isMeshStandardMaterial||x.isMeshPhysicalMaterial)),sizeAttenuation:x.sizeAttenuation===!0,logarithmicDepthBuffer:h,reversedDepthBuffer:se,skinning:D.isSkinnedMesh===!0,morphTargets:H.morphAttributes.position!==void 0,morphNormals:H.morphAttributes.normal!==void 0,morphColors:H.morphAttributes.color!==void 0,morphTargetsCount:pe,morphTextureStride:de,numDirLights:b.directional.length,numPointLights:b.point.length,numSpotLights:b.spot.length,numSpotLightMaps:b.spotLightMap.length,numRectAreaLights:b.rectArea.length,numHemiLights:b.hemi.length,numDirLightShadows:b.directionalShadowMap.length,numPointLightShadows:b.pointShadowMap.length,numSpotLightShadows:b.spotShadowMap.length,numSpotLightShadowsWithMaps:b.numSpotLightShadowsWithMaps,numLightProbes:b.numLightProbes,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:x.dithering,shadowMapEnabled:r.shadowMap.enabled&&V.length>0,shadowMapType:r.shadowMap.type,toneMapping:Pe,decodeVideoTexture:we&&x.map.isVideoTexture===!0&&Xe.getTransfer(x.map.colorSpace)===Ze,decodeVideoTextureEmissive:gt&&x.emissiveMap.isVideoTexture===!0&&Xe.getTransfer(x.emissiveMap.colorSpace)===Ze,premultipliedAlpha:x.premultipliedAlpha,doubleSided:x.side===nn,flipSided:x.side===zt,useDepthPacking:x.depthPacking>=0,depthPacking:x.depthPacking||0,index0AttributeName:x.index0AttributeName,extensionClipCullDistance:ge&&x.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(ge&&x.extensions.multiDraw===!0||Re)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:x.customProgramCacheKey()};return st.vertexUv1s=l.has(1),st.vertexUv2s=l.has(2),st.vertexUv3s=l.has(3),l.clear(),st}function m(x){const b=[];if(x.shaderID?b.push(x.shaderID):(b.push(x.customVertexShaderID),b.push(x.customFragmentShaderID)),x.defines!==void 0)for(const V in x.defines)b.push(V),b.push(x.defines[V]);return x.isRawShaderMaterial===!1&&(p(b,x),v(b,x),b.push(r.outputColorSpace)),b.push(x.customProgramCacheKey),b.join()}function p(x,b){x.push(b.precision),x.push(b.outputColorSpace),x.push(b.envMapMode),x.push(b.envMapCubeUVHeight),x.push(b.mapUv),x.push(b.alphaMapUv),x.push(b.lightMapUv),x.push(b.aoMapUv),x.push(b.bumpMapUv),x.push(b.normalMapUv),x.push(b.displacementMapUv),x.push(b.emissiveMapUv),x.push(b.metalnessMapUv),x.push(b.roughnessMapUv),x.push(b.anisotropyMapUv),x.push(b.clearcoatMapUv),x.push(b.clearcoatNormalMapUv),x.push(b.clearcoatRoughnessMapUv),x.push(b.iridescenceMapUv),x.push(b.iridescenceThicknessMapUv),x.push(b.sheenColorMapUv),x.push(b.sheenRoughnessMapUv),x.push(b.specularMapUv),x.push(b.specularColorMapUv),x.push(b.specularIntensityMapUv),x.push(b.transmissionMapUv),x.push(b.thicknessMapUv),x.push(b.combine),x.push(b.fogExp2),x.push(b.sizeAttenuation),x.push(b.morphTargetsCount),x.push(b.morphAttributeCount),x.push(b.numDirLights),x.push(b.numPointLights),x.push(b.numSpotLights),x.push(b.numSpotLightMaps),x.push(b.numHemiLights),x.push(b.numRectAreaLights),x.push(b.numDirLightShadows),x.push(b.numPointLightShadows),x.push(b.numSpotLightShadows),x.push(b.numSpotLightShadowsWithMaps),x.push(b.numLightProbes),x.push(b.shadowMapType),x.push(b.toneMapping),x.push(b.numClippingPlanes),x.push(b.numClipIntersection),x.push(b.depthPacking)}function v(x,b){a.disableAll(),b.instancing&&a.enable(0),b.instancingColor&&a.enable(1),b.instancingMorph&&a.enable(2),b.matcap&&a.enable(3),b.envMap&&a.enable(4),b.normalMapObjectSpace&&a.enable(5),b.normalMapTangentSpace&&a.enable(6),b.clearcoat&&a.enable(7),b.iridescence&&a.enable(8),b.alphaTest&&a.enable(9),b.vertexColors&&a.enable(10),b.vertexAlphas&&a.enable(11),b.vertexUv1s&&a.enable(12),b.vertexUv2s&&a.enable(13),b.vertexUv3s&&a.enable(14),b.vertexTangents&&a.enable(15),b.anisotropy&&a.enable(16),b.alphaHash&&a.enable(17),b.batching&&a.enable(18),b.dispersion&&a.enable(19),b.batchingColor&&a.enable(20),b.gradientMap&&a.enable(21),x.push(a.mask),a.disableAll(),b.fog&&a.enable(0),b.useFog&&a.enable(1),b.flatShading&&a.enable(2),b.logarithmicDepthBuffer&&a.enable(3),b.reversedDepthBuffer&&a.enable(4),b.skinning&&a.enable(5),b.morphTargets&&a.enable(6),b.morphNormals&&a.enable(7),b.morphColors&&a.enable(8),b.premultipliedAlpha&&a.enable(9),b.shadowMapEnabled&&a.enable(10),b.doubleSided&&a.enable(11),b.flipSided&&a.enable(12),b.useDepthPacking&&a.enable(13),b.dithering&&a.enable(14),b.transmission&&a.enable(15),b.sheen&&a.enable(16),b.opaque&&a.enable(17),b.pointsUvs&&a.enable(18),b.decodeVideoTexture&&a.enable(19),b.decodeVideoTextureEmissive&&a.enable(20),b.alphaToCoverage&&a.enable(21),x.push(a.mask)}function y(x){const b=f[x.type];let V;if(b){const C=fn[b];V=Gh.clone(C.uniforms)}else V=x.uniforms;return V}function E(x,b){let V=u.get(b);return V!==void 0?++V.usedTimes:(V=new G0(r,b,x,i),c.push(V),u.set(b,V)),V}function R(x){if(--x.usedTimes===0){const b=c.indexOf(x);c[b]=c[c.length-1],c.pop(),u.delete(x.cacheKey),x.destroy()}}function T(x){o.remove(x)}function L(){o.dispose()}return{getParameters:g,getProgramCacheKey:m,getUniforms:y,acquireProgram:E,releaseProgram:R,releaseShaderCache:T,programs:c,dispose:L}}function q0(){let r=new WeakMap;function e(a){return r.has(a)}function t(a){let o=r.get(a);return o===void 0&&(o={},r.set(a,o)),o}function n(a){r.delete(a)}function i(a,o,l){r.get(a)[o]=l}function s(){r=new WeakMap}return{has:e,get:t,remove:n,update:i,dispose:s}}function j0(r,e){return r.groupOrder!==e.groupOrder?r.groupOrder-e.groupOrder:r.renderOrder!==e.renderOrder?r.renderOrder-e.renderOrder:r.material.id!==e.material.id?r.material.id-e.material.id:r.materialVariant!==e.materialVariant?r.materialVariant-e.materialVariant:r.z!==e.z?r.z-e.z:r.id-e.id}function Ic(r,e){return r.groupOrder!==e.groupOrder?r.groupOrder-e.groupOrder:r.renderOrder!==e.renderOrder?r.renderOrder-e.renderOrder:r.z!==e.z?e.z-r.z:r.id-e.id}function Nc(){const r=[];let e=0;const t=[],n=[],i=[];function s(){e=0,t.length=0,n.length=0,i.length=0}function a(d){let f=0;return d.isInstancedMesh&&(f+=2),d.isSkinnedMesh&&(f+=1),f}function o(d,f,_,g,m,p){let v=r[e];return v===void 0?(v={id:d.id,object:d,geometry:f,material:_,materialVariant:a(d),groupOrder:g,renderOrder:d.renderOrder,z:m,group:p},r[e]=v):(v.id=d.id,v.object=d,v.geometry=f,v.material=_,v.materialVariant=a(d),v.groupOrder=g,v.renderOrder=d.renderOrder,v.z=m,v.group=p),e++,v}function l(d,f,_,g,m,p){const v=o(d,f,_,g,m,p);_.transmission>0?n.push(v):_.transparent===!0?i.push(v):t.push(v)}function c(d,f,_,g,m,p){const v=o(d,f,_,g,m,p);_.transmission>0?n.unshift(v):_.transparent===!0?i.unshift(v):t.unshift(v)}function u(d,f){t.length>1&&t.sort(d||j0),n.length>1&&n.sort(f||Ic),i.length>1&&i.sort(f||Ic)}function h(){for(let d=e,f=r.length;d<f;d++){const _=r[d];if(_.id===null)break;_.id=null,_.object=null,_.geometry=null,_.material=null,_.group=null}}return{opaque:t,transmissive:n,transparent:i,init:s,push:l,unshift:c,finish:h,sort:u}}function Q0(){let r=new WeakMap;function e(n,i){const s=r.get(n);let a;return s===void 0?(a=new Nc,r.set(n,[a])):i>=s.length?(a=new Nc,s.push(a)):a=s[i],a}function t(){r=new WeakMap}return{get:e,dispose:t}}function Y0(){const r={};return{get:function(e){if(r[e.id]!==void 0)return r[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new I,color:new Le};break;case"SpotLight":t={position:new I,direction:new I,color:new Le,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new I,color:new Le,distance:0,decay:0};break;case"HemisphereLight":t={direction:new I,skyColor:new Le,groundColor:new Le};break;case"RectAreaLight":t={color:new Le,position:new I,halfWidth:new I,halfHeight:new I};break}return r[e.id]=t,t}}}function Z0(){const r={};return{get:function(e){if(r[e.id]!==void 0)return r[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ie};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ie};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ie,shadowCameraNear:1,shadowCameraFar:1e3};break}return r[e.id]=t,t}}}let J0=0;function $0(r,e){return(e.castShadow?2:0)-(r.castShadow?2:0)+(e.map?1:0)-(r.map?1:0)}function eg(r){const e=new Y0,t=Z0(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new I);const i=new I,s=new Ne,a=new Ne;function o(c){let u=0,h=0,d=0;for(let b=0;b<9;b++)n.probe[b].set(0,0,0);let f=0,_=0,g=0,m=0,p=0,v=0,y=0,E=0,R=0,T=0,L=0;c.sort($0);for(let b=0,V=c.length;b<V;b++){const C=c[b],D=C.color,U=C.intensity,H=C.distance;let G=null;if(C.shadow&&C.shadow.map&&(C.shadow.map.texture.format===Ki?G=C.shadow.map.texture:G=C.shadow.map.depthTexture||C.shadow.map.texture),C.isAmbientLight)u+=D.r*U,h+=D.g*U,d+=D.b*U;else if(C.isLightProbe){for(let B=0;B<9;B++)n.probe[B].addScaledVector(C.sh.coefficients[B],U);L++}else if(C.isDirectionalLight){const B=e.get(C);if(B.color.copy(C.color).multiplyScalar(C.intensity),C.castShadow){const z=C.shadow,$=t.get(C);$.shadowIntensity=z.intensity,$.shadowBias=z.bias,$.shadowNormalBias=z.normalBias,$.shadowRadius=z.radius,$.shadowMapSize=z.mapSize,n.directionalShadow[f]=$,n.directionalShadowMap[f]=G,n.directionalShadowMatrix[f]=C.shadow.matrix,v++}n.directional[f]=B,f++}else if(C.isSpotLight){const B=e.get(C);B.position.setFromMatrixPosition(C.matrixWorld),B.color.copy(D).multiplyScalar(U),B.distance=H,B.coneCos=Math.cos(C.angle),B.penumbraCos=Math.cos(C.angle*(1-C.penumbra)),B.decay=C.decay,n.spot[g]=B;const z=C.shadow;if(C.map&&(n.spotLightMap[R]=C.map,R++,z.updateMatrices(C),C.castShadow&&T++),n.spotLightMatrix[g]=z.matrix,C.castShadow){const $=t.get(C);$.shadowIntensity=z.intensity,$.shadowBias=z.bias,$.shadowNormalBias=z.normalBias,$.shadowRadius=z.radius,$.shadowMapSize=z.mapSize,n.spotShadow[g]=$,n.spotShadowMap[g]=G,E++}g++}else if(C.isRectAreaLight){const B=e.get(C);B.color.copy(D).multiplyScalar(U),B.halfWidth.set(C.width*.5,0,0),B.halfHeight.set(0,C.height*.5,0),n.rectArea[m]=B,m++}else if(C.isPointLight){const B=e.get(C);if(B.color.copy(C.color).multiplyScalar(C.intensity),B.distance=C.distance,B.decay=C.decay,C.castShadow){const z=C.shadow,$=t.get(C);$.shadowIntensity=z.intensity,$.shadowBias=z.bias,$.shadowNormalBias=z.normalBias,$.shadowRadius=z.radius,$.shadowMapSize=z.mapSize,$.shadowCameraNear=z.camera.near,$.shadowCameraFar=z.camera.far,n.pointShadow[_]=$,n.pointShadowMap[_]=G,n.pointShadowMatrix[_]=C.shadow.matrix,y++}n.point[_]=B,_++}else if(C.isHemisphereLight){const B=e.get(C);B.skyColor.copy(C.color).multiplyScalar(U),B.groundColor.copy(C.groundColor).multiplyScalar(U),n.hemi[p]=B,p++}}m>0&&(r.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=ae.LTC_FLOAT_1,n.rectAreaLTC2=ae.LTC_FLOAT_2):(n.rectAreaLTC1=ae.LTC_HALF_1,n.rectAreaLTC2=ae.LTC_HALF_2)),n.ambient[0]=u,n.ambient[1]=h,n.ambient[2]=d;const x=n.hash;(x.directionalLength!==f||x.pointLength!==_||x.spotLength!==g||x.rectAreaLength!==m||x.hemiLength!==p||x.numDirectionalShadows!==v||x.numPointShadows!==y||x.numSpotShadows!==E||x.numSpotMaps!==R||x.numLightProbes!==L)&&(n.directional.length=f,n.spot.length=g,n.rectArea.length=m,n.point.length=_,n.hemi.length=p,n.directionalShadow.length=v,n.directionalShadowMap.length=v,n.pointShadow.length=y,n.pointShadowMap.length=y,n.spotShadow.length=E,n.spotShadowMap.length=E,n.directionalShadowMatrix.length=v,n.pointShadowMatrix.length=y,n.spotLightMatrix.length=E+R-T,n.spotLightMap.length=R,n.numSpotLightShadowsWithMaps=T,n.numLightProbes=L,x.directionalLength=f,x.pointLength=_,x.spotLength=g,x.rectAreaLength=m,x.hemiLength=p,x.numDirectionalShadows=v,x.numPointShadows=y,x.numSpotShadows=E,x.numSpotMaps=R,x.numLightProbes=L,n.version=J0++)}function l(c,u){let h=0,d=0,f=0,_=0,g=0;const m=u.matrixWorldInverse;for(let p=0,v=c.length;p<v;p++){const y=c[p];if(y.isDirectionalLight){const E=n.directional[h];E.direction.setFromMatrixPosition(y.matrixWorld),i.setFromMatrixPosition(y.target.matrixWorld),E.direction.sub(i),E.direction.transformDirection(m),h++}else if(y.isSpotLight){const E=n.spot[f];E.position.setFromMatrixPosition(y.matrixWorld),E.position.applyMatrix4(m),E.direction.setFromMatrixPosition(y.matrixWorld),i.setFromMatrixPosition(y.target.matrixWorld),E.direction.sub(i),E.direction.transformDirection(m),f++}else if(y.isRectAreaLight){const E=n.rectArea[_];E.position.setFromMatrixPosition(y.matrixWorld),E.position.applyMatrix4(m),a.identity(),s.copy(y.matrixWorld),s.premultiply(m),a.extractRotation(s),E.halfWidth.set(y.width*.5,0,0),E.halfHeight.set(0,y.height*.5,0),E.halfWidth.applyMatrix4(a),E.halfHeight.applyMatrix4(a),_++}else if(y.isPointLight){const E=n.point[d];E.position.setFromMatrixPosition(y.matrixWorld),E.position.applyMatrix4(m),d++}else if(y.isHemisphereLight){const E=n.hemi[g];E.direction.setFromMatrixPosition(y.matrixWorld),E.direction.transformDirection(m),g++}}}return{setup:o,setupView:l,state:n}}function Oc(r){const e=new eg(r),t=[],n=[];function i(u){c.camera=u,t.length=0,n.length=0}function s(u){t.push(u)}function a(u){n.push(u)}function o(){e.setup(t)}function l(u){e.setupView(t,u)}const c={lightsArray:t,shadowsArray:n,camera:null,lights:e,transmissionRenderTarget:{}};return{init:i,state:c,setupLights:o,setupLightsView:l,pushLight:s,pushShadow:a}}function tg(r){let e=new WeakMap;function t(i,s=0){const a=e.get(i);let o;return a===void 0?(o=new Oc(r),e.set(i,[o])):s>=a.length?(o=new Oc(r),a.push(o)):o=a[s],o}function n(){e=new WeakMap}return{get:t,dispose:n}}const ng=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,ig=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,rg=[new I(1,0,0),new I(-1,0,0),new I(0,1,0),new I(0,-1,0),new I(0,0,1),new I(0,0,-1)],sg=[new I(0,-1,0),new I(0,-1,0),new I(0,0,1),new I(0,0,-1),new I(0,-1,0),new I(0,-1,0)],Dc=new Ne,pr=new I,ba=new I;function ag(r,e,t){let n=new ws;const i=new Ie,s=new Ie,a=new lt,o=new Kh,l=new qh,c={},u=t.maxTextureSize,h={[zn]:zt,[zt]:zn,[nn]:nn},d=new Sn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Ie},radius:{value:4}},vertexShader:ng,fragmentShader:ig}),f=d.clone();f.defines.HORIZONTAL_PASS=1;const _=new Pt;_.setAttribute("position",new Lt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const g=new wt(_,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=ps;let p=this.type;this.render=function(T,L,x){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||T.length===0)return;this.type===cd&&(ye("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=ps);const b=r.getRenderTarget(),V=r.getActiveCubeFace(),C=r.getActiveMipmapLevel(),D=r.state;D.setBlending(Bn),D.buffers.depth.getReversed()===!0?D.buffers.color.setClear(0,0,0,0):D.buffers.color.setClear(1,1,1,1),D.buffers.depth.setTest(!0),D.setScissorTest(!1);const U=p!==this.type;U&&L.traverse(function(H){H.material&&(Array.isArray(H.material)?H.material.forEach(G=>G.needsUpdate=!0):H.material.needsUpdate=!0)});for(let H=0,G=T.length;H<G;H++){const B=T[H],z=B.shadow;if(z===void 0){ye("WebGLShadowMap:",B,"has no shadow.");continue}if(z.autoUpdate===!1&&z.needsUpdate===!1)continue;i.copy(z.mapSize);const $=z.getFrameExtents();i.multiply($),s.copy(z.mapSize),(i.x>u||i.y>u)&&(i.x>u&&(s.x=Math.floor(u/$.x),i.x=s.x*$.x,z.mapSize.x=s.x),i.y>u&&(s.y=Math.floor(u/$.y),i.y=s.y*$.y,z.mapSize.y=s.y));const Y=r.state.buffers.depth.getReversed();if(z.camera._reversedDepth=Y,z.map===null||U===!0){if(z.map!==null&&(z.map.depthTexture!==null&&(z.map.depthTexture.dispose(),z.map.depthTexture=null),z.map.dispose()),this.type===gr){if(B.isPointLight){ye("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}z.map=new Mn(i.x,i.y,{format:Ki,type:Hn,minFilter:vt,magFilter:vt,generateMipmaps:!1}),z.map.texture.name=B.name+".shadowMap",z.map.depthTexture=new wr(i.x,i.y,Qt),z.map.depthTexture.name=B.name+".shadowMapDepth",z.map.depthTexture.format=Gn,z.map.depthTexture.compareFunction=null,z.map.depthTexture.minFilter=St,z.map.depthTexture.magFilter=St}else B.isPointLight?(z.map=new ku(i.x),z.map.depthTexture=new zh(i.x,xn)):(z.map=new Mn(i.x,i.y),z.map.depthTexture=new wr(i.x,i.y,xn)),z.map.depthTexture.name=B.name+".shadowMap",z.map.depthTexture.format=Gn,this.type===ps?(z.map.depthTexture.compareFunction=Y?Xo:Wo,z.map.depthTexture.minFilter=vt,z.map.depthTexture.magFilter=vt):(z.map.depthTexture.compareFunction=null,z.map.depthTexture.minFilter=St,z.map.depthTexture.magFilter=St);z.camera.updateProjectionMatrix()}const ce=z.map.isWebGLCubeRenderTarget?6:1;for(let pe=0;pe<ce;pe++){if(z.map.isWebGLCubeRenderTarget)r.setRenderTarget(z.map,pe),r.clear();else{pe===0&&(r.setRenderTarget(z.map),r.clear());const de=z.getViewport(pe);a.set(s.x*de.x,s.y*de.y,s.x*de.z,s.y*de.w),D.viewport(a)}if(B.isPointLight){const de=z.camera,Fe=z.matrix,ct=B.distance||de.far;ct!==de.far&&(de.far=ct,de.updateProjectionMatrix()),pr.setFromMatrixPosition(B.matrixWorld),de.position.copy(pr),ba.copy(de.position),ba.add(rg[pe]),de.up.copy(sg[pe]),de.lookAt(ba),de.updateMatrixWorld(),Fe.makeTranslation(-pr.x,-pr.y,-pr.z),Dc.multiplyMatrices(de.projectionMatrix,de.matrixWorldInverse),z._frustum.setFromProjectionMatrix(Dc,de.coordinateSystem,de.reversedDepth)}else z.updateMatrices(B);n=z.getFrustum(),E(L,x,z.camera,B,this.type)}z.isPointLightShadow!==!0&&this.type===gr&&v(z,x),z.needsUpdate=!1}p=this.type,m.needsUpdate=!1,r.setRenderTarget(b,V,C)};function v(T,L){const x=e.update(g);d.defines.VSM_SAMPLES!==T.blurSamples&&(d.defines.VSM_SAMPLES=T.blurSamples,f.defines.VSM_SAMPLES=T.blurSamples,d.needsUpdate=!0,f.needsUpdate=!0),T.mapPass===null&&(T.mapPass=new Mn(i.x,i.y,{format:Ki,type:Hn})),d.uniforms.shadow_pass.value=T.map.depthTexture,d.uniforms.resolution.value=T.mapSize,d.uniforms.radius.value=T.radius,r.setRenderTarget(T.mapPass),r.clear(),r.renderBufferDirect(L,null,x,d,g,null),f.uniforms.shadow_pass.value=T.mapPass.texture,f.uniforms.resolution.value=T.mapSize,f.uniforms.radius.value=T.radius,r.setRenderTarget(T.map),r.clear(),r.renderBufferDirect(L,null,x,f,g,null)}function y(T,L,x,b){let V=null;const C=x.isPointLight===!0?T.customDistanceMaterial:T.customDepthMaterial;if(C!==void 0)V=C;else if(V=x.isPointLight===!0?l:o,r.localClippingEnabled&&L.clipShadows===!0&&Array.isArray(L.clippingPlanes)&&L.clippingPlanes.length!==0||L.displacementMap&&L.displacementScale!==0||L.alphaMap&&L.alphaTest>0||L.map&&L.alphaTest>0||L.alphaToCoverage===!0){const D=V.uuid,U=L.uuid;let H=c[D];H===void 0&&(H={},c[D]=H);let G=H[U];G===void 0&&(G=V.clone(),H[U]=G,L.addEventListener("dispose",R)),V=G}if(V.visible=L.visible,V.wireframe=L.wireframe,b===gr?V.side=L.shadowSide!==null?L.shadowSide:L.side:V.side=L.shadowSide!==null?L.shadowSide:h[L.side],V.alphaMap=L.alphaMap,V.alphaTest=L.alphaToCoverage===!0?.5:L.alphaTest,V.map=L.map,V.clipShadows=L.clipShadows,V.clippingPlanes=L.clippingPlanes,V.clipIntersection=L.clipIntersection,V.displacementMap=L.displacementMap,V.displacementScale=L.displacementScale,V.displacementBias=L.displacementBias,V.wireframeLinewidth=L.wireframeLinewidth,V.linewidth=L.linewidth,x.isPointLight===!0&&V.isMeshDistanceMaterial===!0){const D=r.properties.get(V);D.light=x}return V}function E(T,L,x,b,V){if(T.visible===!1)return;if(T.layers.test(L.layers)&&(T.isMesh||T.isLine||T.isPoints)&&(T.castShadow||T.receiveShadow&&V===gr)&&(!T.frustumCulled||n.intersectsObject(T))){T.modelViewMatrix.multiplyMatrices(x.matrixWorldInverse,T.matrixWorld);const U=e.update(T),H=T.material;if(Array.isArray(H)){const G=U.groups;for(let B=0,z=G.length;B<z;B++){const $=G[B],Y=H[$.materialIndex];if(Y&&Y.visible){const ce=y(T,Y,b,V);T.onBeforeShadow(r,T,L,x,U,ce,$),r.renderBufferDirect(x,null,U,ce,T,$),T.onAfterShadow(r,T,L,x,U,ce,$)}}}else if(H.visible){const G=y(T,H,b,V);T.onBeforeShadow(r,T,L,x,U,G,null),r.renderBufferDirect(x,null,U,G,T,null),T.onAfterShadow(r,T,L,x,U,G,null)}}const D=T.children;for(let U=0,H=D.length;U<H;U++)E(D[U],L,x,b,V)}function R(T){T.target.removeEventListener("dispose",R);for(const x in c){const b=c[x],V=T.target.uuid;V in b&&(b[V].dispose(),delete b[V])}}}function og(r,e){function t(){let P=!1;const re=new lt;let te=null;const fe=new lt(0,0,0,0);return{setMask:function(J){te!==J&&!P&&(r.colorMask(J,J,J,J),te=J)},setLocked:function(J){P=J},setClear:function(J,X,ge,Pe,st){st===!0&&(J*=Pe,X*=Pe,ge*=Pe),re.set(J,X,ge,Pe),fe.equals(re)===!1&&(r.clearColor(J,X,ge,Pe),fe.copy(re))},reset:function(){P=!1,te=null,fe.set(-1,0,0,0)}}}function n(){let P=!1,re=!1,te=null,fe=null,J=null;return{setReversed:function(X){if(re!==X){const ge=e.get("EXT_clip_control");X?ge.clipControlEXT(ge.LOWER_LEFT_EXT,ge.ZERO_TO_ONE_EXT):ge.clipControlEXT(ge.LOWER_LEFT_EXT,ge.NEGATIVE_ONE_TO_ONE_EXT),re=X;const Pe=J;J=null,this.setClear(Pe)}},getReversed:function(){return re},setTest:function(X){X?ne(r.DEPTH_TEST):se(r.DEPTH_TEST)},setMask:function(X){te!==X&&!P&&(r.depthMask(X),te=X)},setFunc:function(X){if(re&&(X=Xd[X]),fe!==X){switch(X){case Da:r.depthFunc(r.NEVER);break;case Ua:r.depthFunc(r.ALWAYS);break;case Fa:r.depthFunc(r.LESS);break;case Vi:r.depthFunc(r.LEQUAL);break;case Ba:r.depthFunc(r.EQUAL);break;case ka:r.depthFunc(r.GEQUAL);break;case za:r.depthFunc(r.GREATER);break;case Ha:r.depthFunc(r.NOTEQUAL);break;default:r.depthFunc(r.LEQUAL)}fe=X}},setLocked:function(X){P=X},setClear:function(X){J!==X&&(J=X,re&&(X=1-X),r.clearDepth(X))},reset:function(){P=!1,te=null,fe=null,J=null,re=!1}}}function i(){let P=!1,re=null,te=null,fe=null,J=null,X=null,ge=null,Pe=null,st=null;return{setTest:function(Ye){P||(Ye?ne(r.STENCIL_TEST):se(r.STENCIL_TEST))},setMask:function(Ye){re!==Ye&&!P&&(r.stencilMask(Ye),re=Ye)},setFunc:function(Ye,yn,bn){(te!==Ye||fe!==yn||J!==bn)&&(r.stencilFunc(Ye,yn,bn),te=Ye,fe=yn,J=bn)},setOp:function(Ye,yn,bn){(X!==Ye||ge!==yn||Pe!==bn)&&(r.stencilOp(Ye,yn,bn),X=Ye,ge=yn,Pe=bn)},setLocked:function(Ye){P=Ye},setClear:function(Ye){st!==Ye&&(r.clearStencil(Ye),st=Ye)},reset:function(){P=!1,re=null,te=null,fe=null,J=null,X=null,ge=null,Pe=null,st=null}}}const s=new t,a=new n,o=new i,l=new WeakMap,c=new WeakMap;let u={},h={},d=new WeakMap,f=[],_=null,g=!1,m=null,p=null,v=null,y=null,E=null,R=null,T=null,L=new Le(0,0,0),x=0,b=!1,V=null,C=null,D=null,U=null,H=null;const G=r.getParameter(r.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let B=!1,z=0;const $=r.getParameter(r.VERSION);$.indexOf("WebGL")!==-1?(z=parseFloat(/^WebGL (\d)/.exec($)[1]),B=z>=1):$.indexOf("OpenGL ES")!==-1&&(z=parseFloat(/^OpenGL ES (\d)/.exec($)[1]),B=z>=2);let Y=null,ce={};const pe=r.getParameter(r.SCISSOR_BOX),de=r.getParameter(r.VIEWPORT),Fe=new lt().fromArray(pe),ct=new lt().fromArray(de);function ot(P,re,te,fe){const J=new Uint8Array(4),X=r.createTexture();r.bindTexture(P,X),r.texParameteri(P,r.TEXTURE_MIN_FILTER,r.NEAREST),r.texParameteri(P,r.TEXTURE_MAG_FILTER,r.NEAREST);for(let ge=0;ge<te;ge++)P===r.TEXTURE_3D||P===r.TEXTURE_2D_ARRAY?r.texImage3D(re,0,r.RGBA,1,1,fe,0,r.RGBA,r.UNSIGNED_BYTE,J):r.texImage2D(re+ge,0,r.RGBA,1,1,0,r.RGBA,r.UNSIGNED_BYTE,J);return X}const j={};j[r.TEXTURE_2D]=ot(r.TEXTURE_2D,r.TEXTURE_2D,1),j[r.TEXTURE_CUBE_MAP]=ot(r.TEXTURE_CUBE_MAP,r.TEXTURE_CUBE_MAP_POSITIVE_X,6),j[r.TEXTURE_2D_ARRAY]=ot(r.TEXTURE_2D_ARRAY,r.TEXTURE_2D_ARRAY,1,1),j[r.TEXTURE_3D]=ot(r.TEXTURE_3D,r.TEXTURE_3D,1,1),s.setClear(0,0,0,1),a.setClear(1),o.setClear(0),ne(r.DEPTH_TEST),a.setFunc(Vi),ke(!1),ft(ml),ne(r.CULL_FACE),Qe(Bn);function ne(P){u[P]!==!0&&(r.enable(P),u[P]=!0)}function se(P){u[P]!==!1&&(r.disable(P),u[P]=!1)}function De(P,re){return h[P]!==re?(r.bindFramebuffer(P,re),h[P]=re,P===r.DRAW_FRAMEBUFFER&&(h[r.FRAMEBUFFER]=re),P===r.FRAMEBUFFER&&(h[r.DRAW_FRAMEBUFFER]=re),!0):!1}function Re(P,re){let te=f,fe=!1;if(P){te=d.get(re),te===void 0&&(te=[],d.set(re,te));const J=P.textures;if(te.length!==J.length||te[0]!==r.COLOR_ATTACHMENT0){for(let X=0,ge=J.length;X<ge;X++)te[X]=r.COLOR_ATTACHMENT0+X;te.length=J.length,fe=!0}}else te[0]!==r.BACK&&(te[0]=r.BACK,fe=!0);fe&&r.drawBuffers(te)}function we(P){return _!==P?(r.useProgram(P),_=P,!0):!1}const At={[hi]:r.FUNC_ADD,[dd]:r.FUNC_SUBTRACT,[hd]:r.FUNC_REVERSE_SUBTRACT};At[fd]=r.MIN,At[pd]=r.MAX;const Ke={[md]:r.ZERO,[_d]:r.ONE,[gd]:r.SRC_COLOR,[Na]:r.SRC_ALPHA,[yd]:r.SRC_ALPHA_SATURATE,[vd]:r.DST_COLOR,[xd]:r.DST_ALPHA,[Md]:r.ONE_MINUS_SRC_COLOR,[Oa]:r.ONE_MINUS_SRC_ALPHA,[Ed]:r.ONE_MINUS_DST_COLOR,[Sd]:r.ONE_MINUS_DST_ALPHA,[bd]:r.CONSTANT_COLOR,[Ad]:r.ONE_MINUS_CONSTANT_COLOR,[Td]:r.CONSTANT_ALPHA,[Rd]:r.ONE_MINUS_CONSTANT_ALPHA};function Qe(P,re,te,fe,J,X,ge,Pe,st,Ye){if(P===Bn){g===!0&&(se(r.BLEND),g=!1);return}if(g===!1&&(ne(r.BLEND),g=!0),P!==ud){if(P!==m||Ye!==b){if((p!==hi||E!==hi)&&(r.blendEquation(r.FUNC_ADD),p=hi,E=hi),Ye)switch(P){case zi:r.blendFuncSeparate(r.ONE,r.ONE_MINUS_SRC_ALPHA,r.ONE,r.ONE_MINUS_SRC_ALPHA);break;case _l:r.blendFunc(r.ONE,r.ONE);break;case gl:r.blendFuncSeparate(r.ZERO,r.ONE_MINUS_SRC_COLOR,r.ZERO,r.ONE);break;case Ml:r.blendFuncSeparate(r.DST_COLOR,r.ONE_MINUS_SRC_ALPHA,r.ZERO,r.ONE);break;default:Te("WebGLState: Invalid blending: ",P);break}else switch(P){case zi:r.blendFuncSeparate(r.SRC_ALPHA,r.ONE_MINUS_SRC_ALPHA,r.ONE,r.ONE_MINUS_SRC_ALPHA);break;case _l:r.blendFuncSeparate(r.SRC_ALPHA,r.ONE,r.ONE,r.ONE);break;case gl:Te("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Ml:Te("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Te("WebGLState: Invalid blending: ",P);break}v=null,y=null,R=null,T=null,L.set(0,0,0),x=0,m=P,b=Ye}return}J=J||re,X=X||te,ge=ge||fe,(re!==p||J!==E)&&(r.blendEquationSeparate(At[re],At[J]),p=re,E=J),(te!==v||fe!==y||X!==R||ge!==T)&&(r.blendFuncSeparate(Ke[te],Ke[fe],Ke[X],Ke[ge]),v=te,y=fe,R=X,T=ge),(Pe.equals(L)===!1||st!==x)&&(r.blendColor(Pe.r,Pe.g,Pe.b,st),L.copy(Pe),x=st),m=P,b=!1}function nt(P,re){P.side===nn?se(r.CULL_FACE):ne(r.CULL_FACE);let te=P.side===zt;re&&(te=!te),ke(te),P.blending===zi&&P.transparent===!1?Qe(Bn):Qe(P.blending,P.blendEquation,P.blendSrc,P.blendDst,P.blendEquationAlpha,P.blendSrcAlpha,P.blendDstAlpha,P.blendColor,P.blendAlpha,P.premultipliedAlpha),a.setFunc(P.depthFunc),a.setTest(P.depthTest),a.setMask(P.depthWrite),s.setMask(P.colorWrite);const fe=P.stencilWrite;o.setTest(fe),fe&&(o.setMask(P.stencilWriteMask),o.setFunc(P.stencilFunc,P.stencilRef,P.stencilFuncMask),o.setOp(P.stencilFail,P.stencilZFail,P.stencilZPass)),gt(P.polygonOffset,P.polygonOffsetFactor,P.polygonOffsetUnits),P.alphaToCoverage===!0?ne(r.SAMPLE_ALPHA_TO_COVERAGE):se(r.SAMPLE_ALPHA_TO_COVERAGE)}function ke(P){V!==P&&(P?r.frontFace(r.CW):r.frontFace(r.CCW),V=P)}function ft(P){P!==od?(ne(r.CULL_FACE),P!==C&&(P===ml?r.cullFace(r.BACK):P===ld?r.cullFace(r.FRONT):r.cullFace(r.FRONT_AND_BACK))):se(r.CULL_FACE),C=P}function w(P){P!==D&&(B&&r.lineWidth(P),D=P)}function gt(P,re,te){P?(ne(r.POLYGON_OFFSET_FILL),(U!==re||H!==te)&&(U=re,H=te,a.getReversed()&&(re=-re),r.polygonOffset(re,te))):se(r.POLYGON_OFFSET_FILL)}function je(P){P?ne(r.SCISSOR_TEST):se(r.SCISSOR_TEST)}function rt(P){P===void 0&&(P=r.TEXTURE0+G-1),Y!==P&&(r.activeTexture(P),Y=P)}function Se(P,re,te){te===void 0&&(Y===null?te=r.TEXTURE0+G-1:te=Y);let fe=ce[te];fe===void 0&&(fe={type:void 0,texture:void 0},ce[te]=fe),(fe.type!==P||fe.texture!==re)&&(Y!==te&&(r.activeTexture(te),Y=te),r.bindTexture(P,re||j[P]),fe.type=P,fe.texture=re)}function A(){const P=ce[Y];P!==void 0&&P.type!==void 0&&(r.bindTexture(P.type,null),P.type=void 0,P.texture=void 0)}function M(){try{r.compressedTexImage2D(...arguments)}catch(P){Te("WebGLState:",P)}}function N(){try{r.compressedTexImage3D(...arguments)}catch(P){Te("WebGLState:",P)}}function q(){try{r.texSubImage2D(...arguments)}catch(P){Te("WebGLState:",P)}}function Q(){try{r.texSubImage3D(...arguments)}catch(P){Te("WebGLState:",P)}}function K(){try{r.compressedTexSubImage2D(...arguments)}catch(P){Te("WebGLState:",P)}}function me(){try{r.compressedTexSubImage3D(...arguments)}catch(P){Te("WebGLState:",P)}}function ie(){try{r.texStorage2D(...arguments)}catch(P){Te("WebGLState:",P)}}function Ae(){try{r.texStorage3D(...arguments)}catch(P){Te("WebGLState:",P)}}function Ce(){try{r.texImage2D(...arguments)}catch(P){Te("WebGLState:",P)}}function Z(){try{r.texImage3D(...arguments)}catch(P){Te("WebGLState:",P)}}function ee(P){Fe.equals(P)===!1&&(r.scissor(P.x,P.y,P.z,P.w),Fe.copy(P))}function _e(P){ct.equals(P)===!1&&(r.viewport(P.x,P.y,P.z,P.w),ct.copy(P))}function Me(P,re){let te=c.get(re);te===void 0&&(te=new WeakMap,c.set(re,te));let fe=te.get(P);fe===void 0&&(fe=r.getUniformBlockIndex(re,P.name),te.set(P,fe))}function ue(P,re){const fe=c.get(re).get(P);l.get(re)!==fe&&(r.uniformBlockBinding(re,fe,P.__bindingPointIndex),l.set(re,fe))}function ze(){r.disable(r.BLEND),r.disable(r.CULL_FACE),r.disable(r.DEPTH_TEST),r.disable(r.POLYGON_OFFSET_FILL),r.disable(r.SCISSOR_TEST),r.disable(r.STENCIL_TEST),r.disable(r.SAMPLE_ALPHA_TO_COVERAGE),r.blendEquation(r.FUNC_ADD),r.blendFunc(r.ONE,r.ZERO),r.blendFuncSeparate(r.ONE,r.ZERO,r.ONE,r.ZERO),r.blendColor(0,0,0,0),r.colorMask(!0,!0,!0,!0),r.clearColor(0,0,0,0),r.depthMask(!0),r.depthFunc(r.LESS),a.setReversed(!1),r.clearDepth(1),r.stencilMask(4294967295),r.stencilFunc(r.ALWAYS,0,4294967295),r.stencilOp(r.KEEP,r.KEEP,r.KEEP),r.clearStencil(0),r.cullFace(r.BACK),r.frontFace(r.CCW),r.polygonOffset(0,0),r.activeTexture(r.TEXTURE0),r.bindFramebuffer(r.FRAMEBUFFER,null),r.bindFramebuffer(r.DRAW_FRAMEBUFFER,null),r.bindFramebuffer(r.READ_FRAMEBUFFER,null),r.useProgram(null),r.lineWidth(1),r.scissor(0,0,r.canvas.width,r.canvas.height),r.viewport(0,0,r.canvas.width,r.canvas.height),u={},Y=null,ce={},h={},d=new WeakMap,f=[],_=null,g=!1,m=null,p=null,v=null,y=null,E=null,R=null,T=null,L=new Le(0,0,0),x=0,b=!1,V=null,C=null,D=null,U=null,H=null,Fe.set(0,0,r.canvas.width,r.canvas.height),ct.set(0,0,r.canvas.width,r.canvas.height),s.reset(),a.reset(),o.reset()}return{buffers:{color:s,depth:a,stencil:o},enable:ne,disable:se,bindFramebuffer:De,drawBuffers:Re,useProgram:we,setBlending:Qe,setMaterial:nt,setFlipSided:ke,setCullFace:ft,setLineWidth:w,setPolygonOffset:gt,setScissorTest:je,activeTexture:rt,bindTexture:Se,unbindTexture:A,compressedTexImage2D:M,compressedTexImage3D:N,texImage2D:Ce,texImage3D:Z,updateUBOMapping:Me,uniformBlockBinding:ue,texStorage2D:ie,texStorage3D:Ae,texSubImage2D:q,texSubImage3D:Q,compressedTexSubImage2D:K,compressedTexSubImage3D:me,scissor:ee,viewport:_e,reset:ze}}function lg(r,e,t,n,i,s,a){const o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Ie,u=new WeakMap;let h;const d=new WeakMap;let f=!1;try{f=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function _(A,M){return f?new OffscreenCanvas(A,M):Lr("canvas")}function g(A,M,N){let q=1;const Q=Se(A);if((Q.width>N||Q.height>N)&&(q=N/Math.max(Q.width,Q.height)),q<1)if(typeof HTMLImageElement<"u"&&A instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&A instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&A instanceof ImageBitmap||typeof VideoFrame<"u"&&A instanceof VideoFrame){const K=Math.floor(q*Q.width),me=Math.floor(q*Q.height);h===void 0&&(h=_(K,me));const ie=M?_(K,me):h;return ie.width=K,ie.height=me,ie.getContext("2d").drawImage(A,0,0,K,me),ye("WebGLRenderer: Texture has been resized from ("+Q.width+"x"+Q.height+") to ("+K+"x"+me+")."),ie}else return"data"in A&&ye("WebGLRenderer: Image in DataTexture is too big ("+Q.width+"x"+Q.height+")."),A;return A}function m(A){return A.generateMipmaps}function p(A){r.generateMipmap(A)}function v(A){return A.isWebGLCubeRenderTarget?r.TEXTURE_CUBE_MAP:A.isWebGL3DRenderTarget?r.TEXTURE_3D:A.isWebGLArrayRenderTarget||A.isCompressedArrayTexture?r.TEXTURE_2D_ARRAY:r.TEXTURE_2D}function y(A,M,N,q,Q=!1){if(A!==null){if(r[A]!==void 0)return r[A];ye("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+A+"'")}let K=M;if(M===r.RED&&(N===r.FLOAT&&(K=r.R32F),N===r.HALF_FLOAT&&(K=r.R16F),N===r.UNSIGNED_BYTE&&(K=r.R8)),M===r.RED_INTEGER&&(N===r.UNSIGNED_BYTE&&(K=r.R8UI),N===r.UNSIGNED_SHORT&&(K=r.R16UI),N===r.UNSIGNED_INT&&(K=r.R32UI),N===r.BYTE&&(K=r.R8I),N===r.SHORT&&(K=r.R16I),N===r.INT&&(K=r.R32I)),M===r.RG&&(N===r.FLOAT&&(K=r.RG32F),N===r.HALF_FLOAT&&(K=r.RG16F),N===r.UNSIGNED_BYTE&&(K=r.RG8)),M===r.RG_INTEGER&&(N===r.UNSIGNED_BYTE&&(K=r.RG8UI),N===r.UNSIGNED_SHORT&&(K=r.RG16UI),N===r.UNSIGNED_INT&&(K=r.RG32UI),N===r.BYTE&&(K=r.RG8I),N===r.SHORT&&(K=r.RG16I),N===r.INT&&(K=r.RG32I)),M===r.RGB_INTEGER&&(N===r.UNSIGNED_BYTE&&(K=r.RGB8UI),N===r.UNSIGNED_SHORT&&(K=r.RGB16UI),N===r.UNSIGNED_INT&&(K=r.RGB32UI),N===r.BYTE&&(K=r.RGB8I),N===r.SHORT&&(K=r.RGB16I),N===r.INT&&(K=r.RGB32I)),M===r.RGBA_INTEGER&&(N===r.UNSIGNED_BYTE&&(K=r.RGBA8UI),N===r.UNSIGNED_SHORT&&(K=r.RGBA16UI),N===r.UNSIGNED_INT&&(K=r.RGBA32UI),N===r.BYTE&&(K=r.RGBA8I),N===r.SHORT&&(K=r.RGBA16I),N===r.INT&&(K=r.RGBA32I)),M===r.RGB&&(N===r.UNSIGNED_INT_5_9_9_9_REV&&(K=r.RGB9_E5),N===r.UNSIGNED_INT_10F_11F_11F_REV&&(K=r.R11F_G11F_B10F)),M===r.RGBA){const me=Q?Es:Xe.getTransfer(q);N===r.FLOAT&&(K=r.RGBA32F),N===r.HALF_FLOAT&&(K=r.RGBA16F),N===r.UNSIGNED_BYTE&&(K=me===Ze?r.SRGB8_ALPHA8:r.RGBA8),N===r.UNSIGNED_SHORT_4_4_4_4&&(K=r.RGBA4),N===r.UNSIGNED_SHORT_5_5_5_1&&(K=r.RGB5_A1)}return(K===r.R16F||K===r.R32F||K===r.RG16F||K===r.RG32F||K===r.RGBA16F||K===r.RGBA32F)&&e.get("EXT_color_buffer_float"),K}function E(A,M){let N;return A?M===null||M===xn||M===Ar?N=r.DEPTH24_STENCIL8:M===Qt?N=r.DEPTH32F_STENCIL8:M===br&&(N=r.DEPTH24_STENCIL8,ye("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):M===null||M===xn||M===Ar?N=r.DEPTH_COMPONENT24:M===Qt?N=r.DEPTH_COMPONENT32F:M===br&&(N=r.DEPTH_COMPONENT16),N}function R(A,M){return m(A)===!0||A.isFramebufferTexture&&A.minFilter!==St&&A.minFilter!==vt?Math.log2(Math.max(M.width,M.height))+1:A.mipmaps!==void 0&&A.mipmaps.length>0?A.mipmaps.length:A.isCompressedTexture&&Array.isArray(A.image)?M.mipmaps.length:1}function T(A){const M=A.target;M.removeEventListener("dispose",T),x(M),M.isVideoTexture&&u.delete(M)}function L(A){const M=A.target;M.removeEventListener("dispose",L),V(M)}function x(A){const M=n.get(A);if(M.__webglInit===void 0)return;const N=A.source,q=d.get(N);if(q){const Q=q[M.__cacheKey];Q.usedTimes--,Q.usedTimes===0&&b(A),Object.keys(q).length===0&&d.delete(N)}n.remove(A)}function b(A){const M=n.get(A);r.deleteTexture(M.__webglTexture);const N=A.source,q=d.get(N);delete q[M.__cacheKey],a.memory.textures--}function V(A){const M=n.get(A);if(A.depthTexture&&(A.depthTexture.dispose(),n.remove(A.depthTexture)),A.isWebGLCubeRenderTarget)for(let q=0;q<6;q++){if(Array.isArray(M.__webglFramebuffer[q]))for(let Q=0;Q<M.__webglFramebuffer[q].length;Q++)r.deleteFramebuffer(M.__webglFramebuffer[q][Q]);else r.deleteFramebuffer(M.__webglFramebuffer[q]);M.__webglDepthbuffer&&r.deleteRenderbuffer(M.__webglDepthbuffer[q])}else{if(Array.isArray(M.__webglFramebuffer))for(let q=0;q<M.__webglFramebuffer.length;q++)r.deleteFramebuffer(M.__webglFramebuffer[q]);else r.deleteFramebuffer(M.__webglFramebuffer);if(M.__webglDepthbuffer&&r.deleteRenderbuffer(M.__webglDepthbuffer),M.__webglMultisampledFramebuffer&&r.deleteFramebuffer(M.__webglMultisampledFramebuffer),M.__webglColorRenderbuffer)for(let q=0;q<M.__webglColorRenderbuffer.length;q++)M.__webglColorRenderbuffer[q]&&r.deleteRenderbuffer(M.__webglColorRenderbuffer[q]);M.__webglDepthRenderbuffer&&r.deleteRenderbuffer(M.__webglDepthRenderbuffer)}const N=A.textures;for(let q=0,Q=N.length;q<Q;q++){const K=n.get(N[q]);K.__webglTexture&&(r.deleteTexture(K.__webglTexture),a.memory.textures--),n.remove(N[q])}n.remove(A)}let C=0;function D(){C=0}function U(){const A=C;return A>=i.maxTextures&&ye("WebGLTextures: Trying to use "+A+" texture units while this GPU supports only "+i.maxTextures),C+=1,A}function H(A){const M=[];return M.push(A.wrapS),M.push(A.wrapT),M.push(A.wrapR||0),M.push(A.magFilter),M.push(A.minFilter),M.push(A.anisotropy),M.push(A.internalFormat),M.push(A.format),M.push(A.type),M.push(A.generateMipmaps),M.push(A.premultiplyAlpha),M.push(A.flipY),M.push(A.unpackAlignment),M.push(A.colorSpace),M.join()}function G(A,M){const N=n.get(A);if(A.isVideoTexture&&je(A),A.isRenderTargetTexture===!1&&A.isExternalTexture!==!0&&A.version>0&&N.__version!==A.version){const q=A.image;if(q===null)ye("WebGLRenderer: Texture marked for update but no image data found.");else if(q.complete===!1)ye("WebGLRenderer: Texture marked for update but image is incomplete");else{j(N,A,M);return}}else A.isExternalTexture&&(N.__webglTexture=A.sourceTexture?A.sourceTexture:null);t.bindTexture(r.TEXTURE_2D,N.__webglTexture,r.TEXTURE0+M)}function B(A,M){const N=n.get(A);if(A.isRenderTargetTexture===!1&&A.version>0&&N.__version!==A.version){j(N,A,M);return}else A.isExternalTexture&&(N.__webglTexture=A.sourceTexture?A.sourceTexture:null);t.bindTexture(r.TEXTURE_2D_ARRAY,N.__webglTexture,r.TEXTURE0+M)}function z(A,M){const N=n.get(A);if(A.isRenderTargetTexture===!1&&A.version>0&&N.__version!==A.version){j(N,A,M);return}t.bindTexture(r.TEXTURE_3D,N.__webglTexture,r.TEXTURE0+M)}function $(A,M){const N=n.get(A);if(A.isCubeDepthTexture!==!0&&A.version>0&&N.__version!==A.version){ne(N,A,M);return}t.bindTexture(r.TEXTURE_CUBE_MAP,N.__webglTexture,r.TEXTURE0+M)}const Y={[Xi]:r.REPEAT,[pn]:r.CLAMP_TO_EDGE,[vs]:r.MIRRORED_REPEAT},ce={[St]:r.NEAREST,[hu]:r.NEAREST_MIPMAP_NEAREST,[Mr]:r.NEAREST_MIPMAP_LINEAR,[vt]:r.LINEAR,[ms]:r.LINEAR_MIPMAP_NEAREST,[On]:r.LINEAR_MIPMAP_LINEAR},pe={[Dd]:r.NEVER,[zd]:r.ALWAYS,[Ud]:r.LESS,[Wo]:r.LEQUAL,[Fd]:r.EQUAL,[Xo]:r.GEQUAL,[Bd]:r.GREATER,[kd]:r.NOTEQUAL};function de(A,M){if(M.type===Qt&&e.has("OES_texture_float_linear")===!1&&(M.magFilter===vt||M.magFilter===ms||M.magFilter===Mr||M.magFilter===On||M.minFilter===vt||M.minFilter===ms||M.minFilter===Mr||M.minFilter===On)&&ye("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),r.texParameteri(A,r.TEXTURE_WRAP_S,Y[M.wrapS]),r.texParameteri(A,r.TEXTURE_WRAP_T,Y[M.wrapT]),(A===r.TEXTURE_3D||A===r.TEXTURE_2D_ARRAY)&&r.texParameteri(A,r.TEXTURE_WRAP_R,Y[M.wrapR]),r.texParameteri(A,r.TEXTURE_MAG_FILTER,ce[M.magFilter]),r.texParameteri(A,r.TEXTURE_MIN_FILTER,ce[M.minFilter]),M.compareFunction&&(r.texParameteri(A,r.TEXTURE_COMPARE_MODE,r.COMPARE_REF_TO_TEXTURE),r.texParameteri(A,r.TEXTURE_COMPARE_FUNC,pe[M.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(M.magFilter===St||M.minFilter!==Mr&&M.minFilter!==On||M.type===Qt&&e.has("OES_texture_float_linear")===!1)return;if(M.anisotropy>1||n.get(M).__currentAnisotropy){const N=e.get("EXT_texture_filter_anisotropic");r.texParameterf(A,N.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(M.anisotropy,i.getMaxAnisotropy())),n.get(M).__currentAnisotropy=M.anisotropy}}}function Fe(A,M){let N=!1;A.__webglInit===void 0&&(A.__webglInit=!0,M.addEventListener("dispose",T));const q=M.source;let Q=d.get(q);Q===void 0&&(Q={},d.set(q,Q));const K=H(M);if(K!==A.__cacheKey){Q[K]===void 0&&(Q[K]={texture:r.createTexture(),usedTimes:0},a.memory.textures++,N=!0),Q[K].usedTimes++;const me=Q[A.__cacheKey];me!==void 0&&(Q[A.__cacheKey].usedTimes--,me.usedTimes===0&&b(M)),A.__cacheKey=K,A.__webglTexture=Q[K].texture}return N}function ct(A,M,N){return Math.floor(Math.floor(A/N)/M)}function ot(A,M,N,q){const K=A.updateRanges;if(K.length===0)t.texSubImage2D(r.TEXTURE_2D,0,0,0,M.width,M.height,N,q,M.data);else{K.sort((Z,ee)=>Z.start-ee.start);let me=0;for(let Z=1;Z<K.length;Z++){const ee=K[me],_e=K[Z],Me=ee.start+ee.count,ue=ct(_e.start,M.width,4),ze=ct(ee.start,M.width,4);_e.start<=Me+1&&ue===ze&&ct(_e.start+_e.count-1,M.width,4)===ue?ee.count=Math.max(ee.count,_e.start+_e.count-ee.start):(++me,K[me]=_e)}K.length=me+1;const ie=r.getParameter(r.UNPACK_ROW_LENGTH),Ae=r.getParameter(r.UNPACK_SKIP_PIXELS),Ce=r.getParameter(r.UNPACK_SKIP_ROWS);r.pixelStorei(r.UNPACK_ROW_LENGTH,M.width);for(let Z=0,ee=K.length;Z<ee;Z++){const _e=K[Z],Me=Math.floor(_e.start/4),ue=Math.ceil(_e.count/4),ze=Me%M.width,P=Math.floor(Me/M.width),re=ue,te=1;r.pixelStorei(r.UNPACK_SKIP_PIXELS,ze),r.pixelStorei(r.UNPACK_SKIP_ROWS,P),t.texSubImage2D(r.TEXTURE_2D,0,ze,P,re,te,N,q,M.data)}A.clearUpdateRanges(),r.pixelStorei(r.UNPACK_ROW_LENGTH,ie),r.pixelStorei(r.UNPACK_SKIP_PIXELS,Ae),r.pixelStorei(r.UNPACK_SKIP_ROWS,Ce)}}function j(A,M,N){let q=r.TEXTURE_2D;(M.isDataArrayTexture||M.isCompressedArrayTexture)&&(q=r.TEXTURE_2D_ARRAY),M.isData3DTexture&&(q=r.TEXTURE_3D);const Q=Fe(A,M),K=M.source;t.bindTexture(q,A.__webglTexture,r.TEXTURE0+N);const me=n.get(K);if(K.version!==me.__version||Q===!0){t.activeTexture(r.TEXTURE0+N);const ie=Xe.getPrimaries(Xe.workingColorSpace),Ae=M.colorSpace===Nn?null:Xe.getPrimaries(M.colorSpace),Ce=M.colorSpace===Nn||ie===Ae?r.NONE:r.BROWSER_DEFAULT_WEBGL;r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,M.flipY),r.pixelStorei(r.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),r.pixelStorei(r.UNPACK_ALIGNMENT,M.unpackAlignment),r.pixelStorei(r.UNPACK_COLORSPACE_CONVERSION_WEBGL,Ce);let Z=g(M.image,!1,i.maxTextureSize);Z=rt(M,Z);const ee=s.convert(M.format,M.colorSpace),_e=s.convert(M.type);let Me=y(M.internalFormat,ee,_e,M.colorSpace,M.isVideoTexture);de(q,M);let ue;const ze=M.mipmaps,P=M.isVideoTexture!==!0,re=me.__version===void 0||Q===!0,te=K.dataReady,fe=R(M,Z);if(M.isDepthTexture)Me=E(M.format===pi,M.type),re&&(P?t.texStorage2D(r.TEXTURE_2D,1,Me,Z.width,Z.height):t.texImage2D(r.TEXTURE_2D,0,Me,Z.width,Z.height,0,ee,_e,null));else if(M.isDataTexture)if(ze.length>0){P&&re&&t.texStorage2D(r.TEXTURE_2D,fe,Me,ze[0].width,ze[0].height);for(let J=0,X=ze.length;J<X;J++)ue=ze[J],P?te&&t.texSubImage2D(r.TEXTURE_2D,J,0,0,ue.width,ue.height,ee,_e,ue.data):t.texImage2D(r.TEXTURE_2D,J,Me,ue.width,ue.height,0,ee,_e,ue.data);M.generateMipmaps=!1}else P?(re&&t.texStorage2D(r.TEXTURE_2D,fe,Me,Z.width,Z.height),te&&ot(M,Z,ee,_e)):t.texImage2D(r.TEXTURE_2D,0,Me,Z.width,Z.height,0,ee,_e,Z.data);else if(M.isCompressedTexture)if(M.isCompressedArrayTexture){P&&re&&t.texStorage3D(r.TEXTURE_2D_ARRAY,fe,Me,ze[0].width,ze[0].height,Z.depth);for(let J=0,X=ze.length;J<X;J++)if(ue=ze[J],M.format!==Yt)if(ee!==null)if(P){if(te)if(M.layerUpdates.size>0){const ge=hc(ue.width,ue.height,M.format,M.type);for(const Pe of M.layerUpdates){const st=ue.data.subarray(Pe*ge/ue.data.BYTES_PER_ELEMENT,(Pe+1)*ge/ue.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(r.TEXTURE_2D_ARRAY,J,0,0,Pe,ue.width,ue.height,1,ee,st)}M.clearLayerUpdates()}else t.compressedTexSubImage3D(r.TEXTURE_2D_ARRAY,J,0,0,0,ue.width,ue.height,Z.depth,ee,ue.data)}else t.compressedTexImage3D(r.TEXTURE_2D_ARRAY,J,Me,ue.width,ue.height,Z.depth,0,ue.data,0,0);else ye("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else P?te&&t.texSubImage3D(r.TEXTURE_2D_ARRAY,J,0,0,0,ue.width,ue.height,Z.depth,ee,_e,ue.data):t.texImage3D(r.TEXTURE_2D_ARRAY,J,Me,ue.width,ue.height,Z.depth,0,ee,_e,ue.data)}else{P&&re&&t.texStorage2D(r.TEXTURE_2D,fe,Me,ze[0].width,ze[0].height);for(let J=0,X=ze.length;J<X;J++)ue=ze[J],M.format!==Yt?ee!==null?P?te&&t.compressedTexSubImage2D(r.TEXTURE_2D,J,0,0,ue.width,ue.height,ee,ue.data):t.compressedTexImage2D(r.TEXTURE_2D,J,Me,ue.width,ue.height,0,ue.data):ye("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):P?te&&t.texSubImage2D(r.TEXTURE_2D,J,0,0,ue.width,ue.height,ee,_e,ue.data):t.texImage2D(r.TEXTURE_2D,J,Me,ue.width,ue.height,0,ee,_e,ue.data)}else if(M.isDataArrayTexture)if(P){if(re&&t.texStorage3D(r.TEXTURE_2D_ARRAY,fe,Me,Z.width,Z.height,Z.depth),te)if(M.layerUpdates.size>0){const J=hc(Z.width,Z.height,M.format,M.type);for(const X of M.layerUpdates){const ge=Z.data.subarray(X*J/Z.data.BYTES_PER_ELEMENT,(X+1)*J/Z.data.BYTES_PER_ELEMENT);t.texSubImage3D(r.TEXTURE_2D_ARRAY,0,0,0,X,Z.width,Z.height,1,ee,_e,ge)}M.clearLayerUpdates()}else t.texSubImage3D(r.TEXTURE_2D_ARRAY,0,0,0,0,Z.width,Z.height,Z.depth,ee,_e,Z.data)}else t.texImage3D(r.TEXTURE_2D_ARRAY,0,Me,Z.width,Z.height,Z.depth,0,ee,_e,Z.data);else if(M.isData3DTexture)P?(re&&t.texStorage3D(r.TEXTURE_3D,fe,Me,Z.width,Z.height,Z.depth),te&&t.texSubImage3D(r.TEXTURE_3D,0,0,0,0,Z.width,Z.height,Z.depth,ee,_e,Z.data)):t.texImage3D(r.TEXTURE_3D,0,Me,Z.width,Z.height,Z.depth,0,ee,_e,Z.data);else if(M.isFramebufferTexture){if(re)if(P)t.texStorage2D(r.TEXTURE_2D,fe,Me,Z.width,Z.height);else{let J=Z.width,X=Z.height;for(let ge=0;ge<fe;ge++)t.texImage2D(r.TEXTURE_2D,ge,Me,J,X,0,ee,_e,null),J>>=1,X>>=1}}else if(ze.length>0){if(P&&re){const J=Se(ze[0]);t.texStorage2D(r.TEXTURE_2D,fe,Me,J.width,J.height)}for(let J=0,X=ze.length;J<X;J++)ue=ze[J],P?te&&t.texSubImage2D(r.TEXTURE_2D,J,0,0,ee,_e,ue):t.texImage2D(r.TEXTURE_2D,J,Me,ee,_e,ue);M.generateMipmaps=!1}else if(P){if(re){const J=Se(Z);t.texStorage2D(r.TEXTURE_2D,fe,Me,J.width,J.height)}te&&t.texSubImage2D(r.TEXTURE_2D,0,0,0,ee,_e,Z)}else t.texImage2D(r.TEXTURE_2D,0,Me,ee,_e,Z);m(M)&&p(q),me.__version=K.version,M.onUpdate&&M.onUpdate(M)}A.__version=M.version}function ne(A,M,N){if(M.image.length!==6)return;const q=Fe(A,M),Q=M.source;t.bindTexture(r.TEXTURE_CUBE_MAP,A.__webglTexture,r.TEXTURE0+N);const K=n.get(Q);if(Q.version!==K.__version||q===!0){t.activeTexture(r.TEXTURE0+N);const me=Xe.getPrimaries(Xe.workingColorSpace),ie=M.colorSpace===Nn?null:Xe.getPrimaries(M.colorSpace),Ae=M.colorSpace===Nn||me===ie?r.NONE:r.BROWSER_DEFAULT_WEBGL;r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,M.flipY),r.pixelStorei(r.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),r.pixelStorei(r.UNPACK_ALIGNMENT,M.unpackAlignment),r.pixelStorei(r.UNPACK_COLORSPACE_CONVERSION_WEBGL,Ae);const Ce=M.isCompressedTexture||M.image[0].isCompressedTexture,Z=M.image[0]&&M.image[0].isDataTexture,ee=[];for(let X=0;X<6;X++)!Ce&&!Z?ee[X]=g(M.image[X],!0,i.maxCubemapSize):ee[X]=Z?M.image[X].image:M.image[X],ee[X]=rt(M,ee[X]);const _e=ee[0],Me=s.convert(M.format,M.colorSpace),ue=s.convert(M.type),ze=y(M.internalFormat,Me,ue,M.colorSpace),P=M.isVideoTexture!==!0,re=K.__version===void 0||q===!0,te=Q.dataReady;let fe=R(M,_e);de(r.TEXTURE_CUBE_MAP,M);let J;if(Ce){P&&re&&t.texStorage2D(r.TEXTURE_CUBE_MAP,fe,ze,_e.width,_e.height);for(let X=0;X<6;X++){J=ee[X].mipmaps;for(let ge=0;ge<J.length;ge++){const Pe=J[ge];M.format!==Yt?Me!==null?P?te&&t.compressedTexSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+X,ge,0,0,Pe.width,Pe.height,Me,Pe.data):t.compressedTexImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+X,ge,ze,Pe.width,Pe.height,0,Pe.data):ye("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):P?te&&t.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+X,ge,0,0,Pe.width,Pe.height,Me,ue,Pe.data):t.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+X,ge,ze,Pe.width,Pe.height,0,Me,ue,Pe.data)}}}else{if(J=M.mipmaps,P&&re){J.length>0&&fe++;const X=Se(ee[0]);t.texStorage2D(r.TEXTURE_CUBE_MAP,fe,ze,X.width,X.height)}for(let X=0;X<6;X++)if(Z){P?te&&t.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+X,0,0,0,ee[X].width,ee[X].height,Me,ue,ee[X].data):t.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+X,0,ze,ee[X].width,ee[X].height,0,Me,ue,ee[X].data);for(let ge=0;ge<J.length;ge++){const st=J[ge].image[X].image;P?te&&t.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+X,ge+1,0,0,st.width,st.height,Me,ue,st.data):t.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+X,ge+1,ze,st.width,st.height,0,Me,ue,st.data)}}else{P?te&&t.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+X,0,0,0,Me,ue,ee[X]):t.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+X,0,ze,Me,ue,ee[X]);for(let ge=0;ge<J.length;ge++){const Pe=J[ge];P?te&&t.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+X,ge+1,0,0,Me,ue,Pe.image[X]):t.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+X,ge+1,ze,Me,ue,Pe.image[X])}}}m(M)&&p(r.TEXTURE_CUBE_MAP),K.__version=Q.version,M.onUpdate&&M.onUpdate(M)}A.__version=M.version}function se(A,M,N,q,Q,K){const me=s.convert(N.format,N.colorSpace),ie=s.convert(N.type),Ae=y(N.internalFormat,me,ie,N.colorSpace),Ce=n.get(M),Z=n.get(N);if(Z.__renderTarget=M,!Ce.__hasExternalTextures){const ee=Math.max(1,M.width>>K),_e=Math.max(1,M.height>>K);Q===r.TEXTURE_3D||Q===r.TEXTURE_2D_ARRAY?t.texImage3D(Q,K,Ae,ee,_e,M.depth,0,me,ie,null):t.texImage2D(Q,K,Ae,ee,_e,0,me,ie,null)}t.bindFramebuffer(r.FRAMEBUFFER,A),gt(M)?o.framebufferTexture2DMultisampleEXT(r.FRAMEBUFFER,q,Q,Z.__webglTexture,0,w(M)):(Q===r.TEXTURE_2D||Q>=r.TEXTURE_CUBE_MAP_POSITIVE_X&&Q<=r.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&r.framebufferTexture2D(r.FRAMEBUFFER,q,Q,Z.__webglTexture,K),t.bindFramebuffer(r.FRAMEBUFFER,null)}function De(A,M,N){if(r.bindRenderbuffer(r.RENDERBUFFER,A),M.depthBuffer){const q=M.depthTexture,Q=q&&q.isDepthTexture?q.type:null,K=E(M.stencilBuffer,Q),me=M.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT;gt(M)?o.renderbufferStorageMultisampleEXT(r.RENDERBUFFER,w(M),K,M.width,M.height):N?r.renderbufferStorageMultisample(r.RENDERBUFFER,w(M),K,M.width,M.height):r.renderbufferStorage(r.RENDERBUFFER,K,M.width,M.height),r.framebufferRenderbuffer(r.FRAMEBUFFER,me,r.RENDERBUFFER,A)}else{const q=M.textures;for(let Q=0;Q<q.length;Q++){const K=q[Q],me=s.convert(K.format,K.colorSpace),ie=s.convert(K.type),Ae=y(K.internalFormat,me,ie,K.colorSpace);gt(M)?o.renderbufferStorageMultisampleEXT(r.RENDERBUFFER,w(M),Ae,M.width,M.height):N?r.renderbufferStorageMultisample(r.RENDERBUFFER,w(M),Ae,M.width,M.height):r.renderbufferStorage(r.RENDERBUFFER,Ae,M.width,M.height)}}r.bindRenderbuffer(r.RENDERBUFFER,null)}function Re(A,M,N){const q=M.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(r.FRAMEBUFFER,A),!(M.depthTexture&&M.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const Q=n.get(M.depthTexture);if(Q.__renderTarget=M,(!Q.__webglTexture||M.depthTexture.image.width!==M.width||M.depthTexture.image.height!==M.height)&&(M.depthTexture.image.width=M.width,M.depthTexture.image.height=M.height,M.depthTexture.needsUpdate=!0),q){if(Q.__webglInit===void 0&&(Q.__webglInit=!0,M.depthTexture.addEventListener("dispose",T)),Q.__webglTexture===void 0){Q.__webglTexture=r.createTexture(),t.bindTexture(r.TEXTURE_CUBE_MAP,Q.__webglTexture),de(r.TEXTURE_CUBE_MAP,M.depthTexture);const Ce=s.convert(M.depthTexture.format),Z=s.convert(M.depthTexture.type);let ee;M.depthTexture.format===Gn?ee=r.DEPTH_COMPONENT24:M.depthTexture.format===pi&&(ee=r.DEPTH24_STENCIL8);for(let _e=0;_e<6;_e++)r.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+_e,0,ee,M.width,M.height,0,Ce,Z,null)}}else G(M.depthTexture,0);const K=Q.__webglTexture,me=w(M),ie=q?r.TEXTURE_CUBE_MAP_POSITIVE_X+N:r.TEXTURE_2D,Ae=M.depthTexture.format===pi?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT;if(M.depthTexture.format===Gn)gt(M)?o.framebufferTexture2DMultisampleEXT(r.FRAMEBUFFER,Ae,ie,K,0,me):r.framebufferTexture2D(r.FRAMEBUFFER,Ae,ie,K,0);else if(M.depthTexture.format===pi)gt(M)?o.framebufferTexture2DMultisampleEXT(r.FRAMEBUFFER,Ae,ie,K,0,me):r.framebufferTexture2D(r.FRAMEBUFFER,Ae,ie,K,0);else throw new Error("Unknown depthTexture format")}function we(A){const M=n.get(A),N=A.isWebGLCubeRenderTarget===!0;if(M.__boundDepthTexture!==A.depthTexture){const q=A.depthTexture;if(M.__depthDisposeCallback&&M.__depthDisposeCallback(),q){const Q=()=>{delete M.__boundDepthTexture,delete M.__depthDisposeCallback,q.removeEventListener("dispose",Q)};q.addEventListener("dispose",Q),M.__depthDisposeCallback=Q}M.__boundDepthTexture=q}if(A.depthTexture&&!M.__autoAllocateDepthBuffer)if(N)for(let q=0;q<6;q++)Re(M.__webglFramebuffer[q],A,q);else{const q=A.texture.mipmaps;q&&q.length>0?Re(M.__webglFramebuffer[0],A,0):Re(M.__webglFramebuffer,A,0)}else if(N){M.__webglDepthbuffer=[];for(let q=0;q<6;q++)if(t.bindFramebuffer(r.FRAMEBUFFER,M.__webglFramebuffer[q]),M.__webglDepthbuffer[q]===void 0)M.__webglDepthbuffer[q]=r.createRenderbuffer(),De(M.__webglDepthbuffer[q],A,!1);else{const Q=A.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,K=M.__webglDepthbuffer[q];r.bindRenderbuffer(r.RENDERBUFFER,K),r.framebufferRenderbuffer(r.FRAMEBUFFER,Q,r.RENDERBUFFER,K)}}else{const q=A.texture.mipmaps;if(q&&q.length>0?t.bindFramebuffer(r.FRAMEBUFFER,M.__webglFramebuffer[0]):t.bindFramebuffer(r.FRAMEBUFFER,M.__webglFramebuffer),M.__webglDepthbuffer===void 0)M.__webglDepthbuffer=r.createRenderbuffer(),De(M.__webglDepthbuffer,A,!1);else{const Q=A.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,K=M.__webglDepthbuffer;r.bindRenderbuffer(r.RENDERBUFFER,K),r.framebufferRenderbuffer(r.FRAMEBUFFER,Q,r.RENDERBUFFER,K)}}t.bindFramebuffer(r.FRAMEBUFFER,null)}function At(A,M,N){const q=n.get(A);M!==void 0&&se(q.__webglFramebuffer,A,A.texture,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,0),N!==void 0&&we(A)}function Ke(A){const M=A.texture,N=n.get(A),q=n.get(M);A.addEventListener("dispose",L);const Q=A.textures,K=A.isWebGLCubeRenderTarget===!0,me=Q.length>1;if(me||(q.__webglTexture===void 0&&(q.__webglTexture=r.createTexture()),q.__version=M.version,a.memory.textures++),K){N.__webglFramebuffer=[];for(let ie=0;ie<6;ie++)if(M.mipmaps&&M.mipmaps.length>0){N.__webglFramebuffer[ie]=[];for(let Ae=0;Ae<M.mipmaps.length;Ae++)N.__webglFramebuffer[ie][Ae]=r.createFramebuffer()}else N.__webglFramebuffer[ie]=r.createFramebuffer()}else{if(M.mipmaps&&M.mipmaps.length>0){N.__webglFramebuffer=[];for(let ie=0;ie<M.mipmaps.length;ie++)N.__webglFramebuffer[ie]=r.createFramebuffer()}else N.__webglFramebuffer=r.createFramebuffer();if(me)for(let ie=0,Ae=Q.length;ie<Ae;ie++){const Ce=n.get(Q[ie]);Ce.__webglTexture===void 0&&(Ce.__webglTexture=r.createTexture(),a.memory.textures++)}if(A.samples>0&&gt(A)===!1){N.__webglMultisampledFramebuffer=r.createFramebuffer(),N.__webglColorRenderbuffer=[],t.bindFramebuffer(r.FRAMEBUFFER,N.__webglMultisampledFramebuffer);for(let ie=0;ie<Q.length;ie++){const Ae=Q[ie];N.__webglColorRenderbuffer[ie]=r.createRenderbuffer(),r.bindRenderbuffer(r.RENDERBUFFER,N.__webglColorRenderbuffer[ie]);const Ce=s.convert(Ae.format,Ae.colorSpace),Z=s.convert(Ae.type),ee=y(Ae.internalFormat,Ce,Z,Ae.colorSpace,A.isXRRenderTarget===!0),_e=w(A);r.renderbufferStorageMultisample(r.RENDERBUFFER,_e,ee,A.width,A.height),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0+ie,r.RENDERBUFFER,N.__webglColorRenderbuffer[ie])}r.bindRenderbuffer(r.RENDERBUFFER,null),A.depthBuffer&&(N.__webglDepthRenderbuffer=r.createRenderbuffer(),De(N.__webglDepthRenderbuffer,A,!0)),t.bindFramebuffer(r.FRAMEBUFFER,null)}}if(K){t.bindTexture(r.TEXTURE_CUBE_MAP,q.__webglTexture),de(r.TEXTURE_CUBE_MAP,M);for(let ie=0;ie<6;ie++)if(M.mipmaps&&M.mipmaps.length>0)for(let Ae=0;Ae<M.mipmaps.length;Ae++)se(N.__webglFramebuffer[ie][Ae],A,M,r.COLOR_ATTACHMENT0,r.TEXTURE_CUBE_MAP_POSITIVE_X+ie,Ae);else se(N.__webglFramebuffer[ie],A,M,r.COLOR_ATTACHMENT0,r.TEXTURE_CUBE_MAP_POSITIVE_X+ie,0);m(M)&&p(r.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(me){for(let ie=0,Ae=Q.length;ie<Ae;ie++){const Ce=Q[ie],Z=n.get(Ce);let ee=r.TEXTURE_2D;(A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&(ee=A.isWebGL3DRenderTarget?r.TEXTURE_3D:r.TEXTURE_2D_ARRAY),t.bindTexture(ee,Z.__webglTexture),de(ee,Ce),se(N.__webglFramebuffer,A,Ce,r.COLOR_ATTACHMENT0+ie,ee,0),m(Ce)&&p(ee)}t.unbindTexture()}else{let ie=r.TEXTURE_2D;if((A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&(ie=A.isWebGL3DRenderTarget?r.TEXTURE_3D:r.TEXTURE_2D_ARRAY),t.bindTexture(ie,q.__webglTexture),de(ie,M),M.mipmaps&&M.mipmaps.length>0)for(let Ae=0;Ae<M.mipmaps.length;Ae++)se(N.__webglFramebuffer[Ae],A,M,r.COLOR_ATTACHMENT0,ie,Ae);else se(N.__webglFramebuffer,A,M,r.COLOR_ATTACHMENT0,ie,0);m(M)&&p(ie),t.unbindTexture()}A.depthBuffer&&we(A)}function Qe(A){const M=A.textures;for(let N=0,q=M.length;N<q;N++){const Q=M[N];if(m(Q)){const K=v(A),me=n.get(Q).__webglTexture;t.bindTexture(K,me),p(K),t.unbindTexture()}}}const nt=[],ke=[];function ft(A){if(A.samples>0){if(gt(A)===!1){const M=A.textures,N=A.width,q=A.height;let Q=r.COLOR_BUFFER_BIT;const K=A.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,me=n.get(A),ie=M.length>1;if(ie)for(let Ce=0;Ce<M.length;Ce++)t.bindFramebuffer(r.FRAMEBUFFER,me.__webglMultisampledFramebuffer),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0+Ce,r.RENDERBUFFER,null),t.bindFramebuffer(r.FRAMEBUFFER,me.__webglFramebuffer),r.framebufferTexture2D(r.DRAW_FRAMEBUFFER,r.COLOR_ATTACHMENT0+Ce,r.TEXTURE_2D,null,0);t.bindFramebuffer(r.READ_FRAMEBUFFER,me.__webglMultisampledFramebuffer);const Ae=A.texture.mipmaps;Ae&&Ae.length>0?t.bindFramebuffer(r.DRAW_FRAMEBUFFER,me.__webglFramebuffer[0]):t.bindFramebuffer(r.DRAW_FRAMEBUFFER,me.__webglFramebuffer);for(let Ce=0;Ce<M.length;Ce++){if(A.resolveDepthBuffer&&(A.depthBuffer&&(Q|=r.DEPTH_BUFFER_BIT),A.stencilBuffer&&A.resolveStencilBuffer&&(Q|=r.STENCIL_BUFFER_BIT)),ie){r.framebufferRenderbuffer(r.READ_FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.RENDERBUFFER,me.__webglColorRenderbuffer[Ce]);const Z=n.get(M[Ce]).__webglTexture;r.framebufferTexture2D(r.DRAW_FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,Z,0)}r.blitFramebuffer(0,0,N,q,0,0,N,q,Q,r.NEAREST),l===!0&&(nt.length=0,ke.length=0,nt.push(r.COLOR_ATTACHMENT0+Ce),A.depthBuffer&&A.resolveDepthBuffer===!1&&(nt.push(K),ke.push(K),r.invalidateFramebuffer(r.DRAW_FRAMEBUFFER,ke)),r.invalidateFramebuffer(r.READ_FRAMEBUFFER,nt))}if(t.bindFramebuffer(r.READ_FRAMEBUFFER,null),t.bindFramebuffer(r.DRAW_FRAMEBUFFER,null),ie)for(let Ce=0;Ce<M.length;Ce++){t.bindFramebuffer(r.FRAMEBUFFER,me.__webglMultisampledFramebuffer),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0+Ce,r.RENDERBUFFER,me.__webglColorRenderbuffer[Ce]);const Z=n.get(M[Ce]).__webglTexture;t.bindFramebuffer(r.FRAMEBUFFER,me.__webglFramebuffer),r.framebufferTexture2D(r.DRAW_FRAMEBUFFER,r.COLOR_ATTACHMENT0+Ce,r.TEXTURE_2D,Z,0)}t.bindFramebuffer(r.DRAW_FRAMEBUFFER,me.__webglMultisampledFramebuffer)}else if(A.depthBuffer&&A.resolveDepthBuffer===!1&&l){const M=A.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT;r.invalidateFramebuffer(r.DRAW_FRAMEBUFFER,[M])}}}function w(A){return Math.min(i.maxSamples,A.samples)}function gt(A){const M=n.get(A);return A.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&M.__useRenderToTexture!==!1}function je(A){const M=a.render.frame;u.get(A)!==M&&(u.set(A,M),A.update())}function rt(A,M){const N=A.colorSpace,q=A.format,Q=A.type;return A.isCompressedTexture===!0||A.isVideoTexture===!0||N!==Dt&&N!==Nn&&(Xe.getTransfer(N)===Ze?(q!==Yt||Q!==Wt)&&ye("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Te("WebGLTextures: Unsupported texture color space:",N)),M}function Se(A){return typeof HTMLImageElement<"u"&&A instanceof HTMLImageElement?(c.width=A.naturalWidth||A.width,c.height=A.naturalHeight||A.height):typeof VideoFrame<"u"&&A instanceof VideoFrame?(c.width=A.displayWidth,c.height=A.displayHeight):(c.width=A.width,c.height=A.height),c}this.allocateTextureUnit=U,this.resetTextureUnits=D,this.setTexture2D=G,this.setTexture2DArray=B,this.setTexture3D=z,this.setTextureCube=$,this.rebindTextures=At,this.setupRenderTarget=Ke,this.updateRenderTargetMipmap=Qe,this.updateMultisampleRenderTarget=ft,this.setupDepthRenderbuffer=we,this.setupFrameBufferTexture=se,this.useMultisampledRTT=gt,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function cg(r,e){function t(n,i=Nn){let s;const a=Xe.getTransfer(i);if(n===Wt)return r.UNSIGNED_BYTE;if(n===Fo)return r.UNSIGNED_SHORT_4_4_4_4;if(n===Bo)return r.UNSIGNED_SHORT_5_5_5_1;if(n===mu)return r.UNSIGNED_INT_5_9_9_9_REV;if(n===_u)return r.UNSIGNED_INT_10F_11F_11F_REV;if(n===fu)return r.BYTE;if(n===pu)return r.SHORT;if(n===br)return r.UNSIGNED_SHORT;if(n===Uo)return r.INT;if(n===xn)return r.UNSIGNED_INT;if(n===Qt)return r.FLOAT;if(n===Hn)return r.HALF_FLOAT;if(n===gu)return r.ALPHA;if(n===Mu)return r.RGB;if(n===Yt)return r.RGBA;if(n===Gn)return r.DEPTH_COMPONENT;if(n===pi)return r.DEPTH_STENCIL;if(n===ko)return r.RED;if(n===zo)return r.RED_INTEGER;if(n===Ki)return r.RG;if(n===Ho)return r.RG_INTEGER;if(n===Go)return r.RGBA_INTEGER;if(n===_s||n===gs||n===Ms||n===xs)if(a===Ze)if(s=e.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(n===_s)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===gs)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===Ms)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===xs)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=e.get("WEBGL_compressed_texture_s3tc"),s!==null){if(n===_s)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===gs)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===Ms)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===xs)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Ga||n===Va||n===Wa||n===Xa)if(s=e.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(n===Ga)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Va)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Wa)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Xa)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Ka||n===qa||n===ja||n===Qa||n===Ya||n===Za||n===Ja)if(s=e.get("WEBGL_compressed_texture_etc"),s!==null){if(n===Ka||n===qa)return a===Ze?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(n===ja)return a===Ze?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC;if(n===Qa)return s.COMPRESSED_R11_EAC;if(n===Ya)return s.COMPRESSED_SIGNED_R11_EAC;if(n===Za)return s.COMPRESSED_RG11_EAC;if(n===Ja)return s.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===$a||n===eo||n===to||n===no||n===io||n===ro||n===so||n===ao||n===oo||n===lo||n===co||n===uo||n===ho||n===fo)if(s=e.get("WEBGL_compressed_texture_astc"),s!==null){if(n===$a)return a===Ze?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===eo)return a===Ze?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===to)return a===Ze?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===no)return a===Ze?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===io)return a===Ze?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===ro)return a===Ze?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===so)return a===Ze?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===ao)return a===Ze?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===oo)return a===Ze?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===lo)return a===Ze?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===co)return a===Ze?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===uo)return a===Ze?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===ho)return a===Ze?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===fo)return a===Ze?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===po||n===mo||n===_o)if(s=e.get("EXT_texture_compression_bptc"),s!==null){if(n===po)return a===Ze?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===mo)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===_o)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===go||n===Mo||n===xo||n===So)if(s=e.get("EXT_texture_compression_rgtc"),s!==null){if(n===go)return s.COMPRESSED_RED_RGTC1_EXT;if(n===Mo)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===xo)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===So)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Ar?r.UNSIGNED_INT_24_8:r[n]!==void 0?r[n]:null}return{convert:t}}const ug=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,dg=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class hg{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){const n=new wu(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,n=new Sn({vertexShader:ug,fragmentShader:dg,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new wt(new Or(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class fg extends _i{constructor(e,t){super();const n=this;let i=null,s=1,a=null,o="local-floor",l=1,c=null,u=null,h=null,d=null,f=null,_=null;const g=typeof XRWebGLBinding<"u",m=new hg,p={},v=t.getContextAttributes();let y=null,E=null;const R=[],T=[],L=new Ie;let x=null;const b=new kt;b.viewport=new lt;const V=new kt;V.viewport=new lt;const C=[b,V],D=new _f;let U=null,H=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(j){let ne=R[j];return ne===void 0&&(ne=new Ys,R[j]=ne),ne.getTargetRaySpace()},this.getControllerGrip=function(j){let ne=R[j];return ne===void 0&&(ne=new Ys,R[j]=ne),ne.getGripSpace()},this.getHand=function(j){let ne=R[j];return ne===void 0&&(ne=new Ys,R[j]=ne),ne.getHandSpace()};function G(j){const ne=T.indexOf(j.inputSource);if(ne===-1)return;const se=R[ne];se!==void 0&&(se.update(j.inputSource,j.frame,c||a),se.dispatchEvent({type:j.type,data:j.inputSource}))}function B(){i.removeEventListener("select",G),i.removeEventListener("selectstart",G),i.removeEventListener("selectend",G),i.removeEventListener("squeeze",G),i.removeEventListener("squeezestart",G),i.removeEventListener("squeezeend",G),i.removeEventListener("end",B),i.removeEventListener("inputsourceschange",z);for(let j=0;j<R.length;j++){const ne=T[j];ne!==null&&(T[j]=null,R[j].disconnect(ne))}U=null,H=null,m.reset();for(const j in p)delete p[j];e.setRenderTarget(y),f=null,d=null,h=null,i=null,E=null,ot.stop(),n.isPresenting=!1,e.setPixelRatio(x),e.setSize(L.width,L.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(j){s=j,n.isPresenting===!0&&ye("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(j){o=j,n.isPresenting===!0&&ye("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(j){c=j},this.getBaseLayer=function(){return d!==null?d:f},this.getBinding=function(){return h===null&&g&&(h=new XRWebGLBinding(i,t)),h},this.getFrame=function(){return _},this.getSession=function(){return i},this.setSession=async function(j){if(i=j,i!==null){if(y=e.getRenderTarget(),i.addEventListener("select",G),i.addEventListener("selectstart",G),i.addEventListener("selectend",G),i.addEventListener("squeeze",G),i.addEventListener("squeezestart",G),i.addEventListener("squeezeend",G),i.addEventListener("end",B),i.addEventListener("inputsourceschange",z),v.xrCompatible!==!0&&await t.makeXRCompatible(),x=e.getPixelRatio(),e.getSize(L),g&&"createProjectionLayer"in XRWebGLBinding.prototype){let se=null,De=null,Re=null;v.depth&&(Re=v.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,se=v.stencil?pi:Gn,De=v.stencil?Ar:xn);const we={colorFormat:t.RGBA8,depthFormat:Re,scaleFactor:s};h=this.getBinding(),d=h.createProjectionLayer(we),i.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),E=new Mn(d.textureWidth,d.textureHeight,{format:Yt,type:Wt,depthTexture:new wr(d.textureWidth,d.textureHeight,De,void 0,void 0,void 0,void 0,void 0,void 0,se),stencilBuffer:v.stencil,colorSpace:e.outputColorSpace,samples:v.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1})}else{const se={antialias:v.antialias,alpha:!0,depth:v.depth,stencil:v.stencil,framebufferScaleFactor:s};f=new XRWebGLLayer(i,t,se),i.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),E=new Mn(f.framebufferWidth,f.framebufferHeight,{format:Yt,type:Wt,colorSpace:e.outputColorSpace,stencilBuffer:v.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1})}E.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await i.requestReferenceSpace(o),ot.setContext(i),ot.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function z(j){for(let ne=0;ne<j.removed.length;ne++){const se=j.removed[ne],De=T.indexOf(se);De>=0&&(T[De]=null,R[De].disconnect(se))}for(let ne=0;ne<j.added.length;ne++){const se=j.added[ne];let De=T.indexOf(se);if(De===-1){for(let we=0;we<R.length;we++)if(we>=T.length){T.push(se),De=we;break}else if(T[we]===null){T[we]=se,De=we;break}if(De===-1)break}const Re=R[De];Re&&Re.connect(se)}}const $=new I,Y=new I;function ce(j,ne,se){$.setFromMatrixPosition(ne.matrixWorld),Y.setFromMatrixPosition(se.matrixWorld);const De=$.distanceTo(Y),Re=ne.projectionMatrix.elements,we=se.projectionMatrix.elements,At=Re[14]/(Re[10]-1),Ke=Re[14]/(Re[10]+1),Qe=(Re[9]+1)/Re[5],nt=(Re[9]-1)/Re[5],ke=(Re[8]-1)/Re[0],ft=(we[8]+1)/we[0],w=At*ke,gt=At*ft,je=De/(-ke+ft),rt=je*-ke;if(ne.matrixWorld.decompose(j.position,j.quaternion,j.scale),j.translateX(rt),j.translateZ(je),j.matrixWorld.compose(j.position,j.quaternion,j.scale),j.matrixWorldInverse.copy(j.matrixWorld).invert(),Re[10]===-1)j.projectionMatrix.copy(ne.projectionMatrix),j.projectionMatrixInverse.copy(ne.projectionMatrixInverse);else{const Se=At+je,A=Ke+je,M=w-rt,N=gt+(De-rt),q=Qe*Ke/A*Se,Q=nt*Ke/A*Se;j.projectionMatrix.makePerspective(M,N,q,Q,Se,A),j.projectionMatrixInverse.copy(j.projectionMatrix).invert()}}function pe(j,ne){ne===null?j.matrixWorld.copy(j.matrix):j.matrixWorld.multiplyMatrices(ne.matrixWorld,j.matrix),j.matrixWorldInverse.copy(j.matrixWorld).invert()}this.updateCamera=function(j){if(i===null)return;let ne=j.near,se=j.far;m.texture!==null&&(m.depthNear>0&&(ne=m.depthNear),m.depthFar>0&&(se=m.depthFar)),D.near=V.near=b.near=ne,D.far=V.far=b.far=se,(U!==D.near||H!==D.far)&&(i.updateRenderState({depthNear:D.near,depthFar:D.far}),U=D.near,H=D.far),D.layers.mask=j.layers.mask|6,b.layers.mask=D.layers.mask&-5,V.layers.mask=D.layers.mask&-3;const De=j.parent,Re=D.cameras;pe(D,De);for(let we=0;we<Re.length;we++)pe(Re[we],De);Re.length===2?ce(D,b,V):D.projectionMatrix.copy(b.projectionMatrix),de(j,D,De)};function de(j,ne,se){se===null?j.matrix.copy(ne.matrixWorld):(j.matrix.copy(se.matrixWorld),j.matrix.invert(),j.matrix.multiply(ne.matrixWorld)),j.matrix.decompose(j.position,j.quaternion,j.scale),j.updateMatrixWorld(!0),j.projectionMatrix.copy(ne.projectionMatrix),j.projectionMatrixInverse.copy(ne.projectionMatrixInverse),j.isPerspectiveCamera&&(j.fov=qi*2*Math.atan(1/j.projectionMatrix.elements[5]),j.zoom=1)}this.getCamera=function(){return D},this.getFoveation=function(){if(!(d===null&&f===null))return l},this.setFoveation=function(j){l=j,d!==null&&(d.fixedFoveation=j),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=j)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(D)},this.getCameraTexture=function(j){return p[j]};let Fe=null;function ct(j,ne){if(u=ne.getViewerPose(c||a),_=ne,u!==null){const se=u.views;f!==null&&(e.setRenderTargetFramebuffer(E,f.framebuffer),e.setRenderTarget(E));let De=!1;se.length!==D.cameras.length&&(D.cameras.length=0,De=!0);for(let Ke=0;Ke<se.length;Ke++){const Qe=se[Ke];let nt=null;if(f!==null)nt=f.getViewport(Qe);else{const ft=h.getViewSubImage(d,Qe);nt=ft.viewport,Ke===0&&(e.setRenderTargetTextures(E,ft.colorTexture,ft.depthStencilTexture),e.setRenderTarget(E))}let ke=C[Ke];ke===void 0&&(ke=new kt,ke.layers.enable(Ke),ke.viewport=new lt,C[Ke]=ke),ke.matrix.fromArray(Qe.transform.matrix),ke.matrix.decompose(ke.position,ke.quaternion,ke.scale),ke.projectionMatrix.fromArray(Qe.projectionMatrix),ke.projectionMatrixInverse.copy(ke.projectionMatrix).invert(),ke.viewport.set(nt.x,nt.y,nt.width,nt.height),Ke===0&&(D.matrix.copy(ke.matrix),D.matrix.decompose(D.position,D.quaternion,D.scale)),De===!0&&D.cameras.push(ke)}const Re=i.enabledFeatures;if(Re&&Re.includes("depth-sensing")&&i.depthUsage=="gpu-optimized"&&g){h=n.getBinding();const Ke=h.getDepthInformation(se[0]);Ke&&Ke.isValid&&Ke.texture&&m.init(Ke,i.renderState)}if(Re&&Re.includes("camera-access")&&g){e.state.unbindTexture(),h=n.getBinding();for(let Ke=0;Ke<se.length;Ke++){const Qe=se[Ke].camera;if(Qe){let nt=p[Qe];nt||(nt=new wu,p[Qe]=nt);const ke=h.getCameraImage(Qe);nt.sourceTexture=ke}}}}for(let se=0;se<R.length;se++){const De=T[se],Re=R[se];De!==null&&Re!==void 0&&Re.update(De,ne,c||a)}Fe&&Fe(j,ne),ne.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:ne}),_=null}const ot=new Bu;ot.setAnimationLoop(ct),this.setAnimationLoop=function(j){Fe=j},this.dispose=function(){}}}const li=new an,pg=new Ne;function mg(r,e){function t(m,p){m.matrixAutoUpdate===!0&&m.updateMatrix(),p.value.copy(m.matrix)}function n(m,p){p.color.getRGB(m.fogColor.value,Nu(r)),p.isFog?(m.fogNear.value=p.near,m.fogFar.value=p.far):p.isFogExp2&&(m.fogDensity.value=p.density)}function i(m,p,v,y,E){p.isMeshBasicMaterial?s(m,p):p.isMeshLambertMaterial?(s(m,p),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)):p.isMeshToonMaterial?(s(m,p),h(m,p)):p.isMeshPhongMaterial?(s(m,p),u(m,p),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)):p.isMeshStandardMaterial?(s(m,p),d(m,p),p.isMeshPhysicalMaterial&&f(m,p,E)):p.isMeshMatcapMaterial?(s(m,p),_(m,p)):p.isMeshDepthMaterial?s(m,p):p.isMeshDistanceMaterial?(s(m,p),g(m,p)):p.isMeshNormalMaterial?s(m,p):p.isLineBasicMaterial?(a(m,p),p.isLineDashedMaterial&&o(m,p)):p.isPointsMaterial?l(m,p,v,y):p.isSpriteMaterial?c(m,p):p.isShadowMaterial?(m.color.value.copy(p.color),m.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function s(m,p){m.opacity.value=p.opacity,p.color&&m.diffuse.value.copy(p.color),p.emissive&&m.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(m.map.value=p.map,t(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.bumpMap&&(m.bumpMap.value=p.bumpMap,t(p.bumpMap,m.bumpMapTransform),m.bumpScale.value=p.bumpScale,p.side===zt&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,t(p.normalMap,m.normalMapTransform),m.normalScale.value.copy(p.normalScale),p.side===zt&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,t(p.displacementMap,m.displacementMapTransform),m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap,t(p.emissiveMap,m.emissiveMapTransform)),p.specularMap&&(m.specularMap.value=p.specularMap,t(p.specularMap,m.specularMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest);const v=e.get(p),y=v.envMap,E=v.envMapRotation;y&&(m.envMap.value=y,li.copy(E),li.x*=-1,li.y*=-1,li.z*=-1,y.isCubeTexture&&y.isRenderTargetTexture===!1&&(li.y*=-1,li.z*=-1),m.envMapRotation.value.setFromMatrix4(pg.makeRotationFromEuler(li)),m.flipEnvMap.value=y.isCubeTexture&&y.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=p.reflectivity,m.ior.value=p.ior,m.refractionRatio.value=p.refractionRatio),p.lightMap&&(m.lightMap.value=p.lightMap,m.lightMapIntensity.value=p.lightMapIntensity,t(p.lightMap,m.lightMapTransform)),p.aoMap&&(m.aoMap.value=p.aoMap,m.aoMapIntensity.value=p.aoMapIntensity,t(p.aoMap,m.aoMapTransform))}function a(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,p.map&&(m.map.value=p.map,t(p.map,m.mapTransform))}function o(m,p){m.dashSize.value=p.dashSize,m.totalSize.value=p.dashSize+p.gapSize,m.scale.value=p.scale}function l(m,p,v,y){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.size.value=p.size*v,m.scale.value=y*.5,p.map&&(m.map.value=p.map,t(p.map,m.uvTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function c(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.rotation.value=p.rotation,p.map&&(m.map.value=p.map,t(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function u(m,p){m.specular.value.copy(p.specular),m.shininess.value=Math.max(p.shininess,1e-4)}function h(m,p){p.gradientMap&&(m.gradientMap.value=p.gradientMap)}function d(m,p){m.metalness.value=p.metalness,p.metalnessMap&&(m.metalnessMap.value=p.metalnessMap,t(p.metalnessMap,m.metalnessMapTransform)),m.roughness.value=p.roughness,p.roughnessMap&&(m.roughnessMap.value=p.roughnessMap,t(p.roughnessMap,m.roughnessMapTransform)),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)}function f(m,p,v){m.ior.value=p.ior,p.sheen>0&&(m.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),m.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(m.sheenColorMap.value=p.sheenColorMap,t(p.sheenColorMap,m.sheenColorMapTransform)),p.sheenRoughnessMap&&(m.sheenRoughnessMap.value=p.sheenRoughnessMap,t(p.sheenRoughnessMap,m.sheenRoughnessMapTransform))),p.clearcoat>0&&(m.clearcoat.value=p.clearcoat,m.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(m.clearcoatMap.value=p.clearcoatMap,t(p.clearcoatMap,m.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,t(p.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(m.clearcoatNormalMap.value=p.clearcoatNormalMap,t(p.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===zt&&m.clearcoatNormalScale.value.negate())),p.dispersion>0&&(m.dispersion.value=p.dispersion),p.iridescence>0&&(m.iridescence.value=p.iridescence,m.iridescenceIOR.value=p.iridescenceIOR,m.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(m.iridescenceMap.value=p.iridescenceMap,t(p.iridescenceMap,m.iridescenceMapTransform)),p.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=p.iridescenceThicknessMap,t(p.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),p.transmission>0&&(m.transmission.value=p.transmission,m.transmissionSamplerMap.value=v.texture,m.transmissionSamplerSize.value.set(v.width,v.height),p.transmissionMap&&(m.transmissionMap.value=p.transmissionMap,t(p.transmissionMap,m.transmissionMapTransform)),m.thickness.value=p.thickness,p.thicknessMap&&(m.thicknessMap.value=p.thicknessMap,t(p.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=p.attenuationDistance,m.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(m.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(m.anisotropyMap.value=p.anisotropyMap,t(p.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=p.specularIntensity,m.specularColor.value.copy(p.specularColor),p.specularColorMap&&(m.specularColorMap.value=p.specularColorMap,t(p.specularColorMap,m.specularColorMapTransform)),p.specularIntensityMap&&(m.specularIntensityMap.value=p.specularIntensityMap,t(p.specularIntensityMap,m.specularIntensityMapTransform))}function _(m,p){p.matcap&&(m.matcap.value=p.matcap)}function g(m,p){const v=e.get(p).light;m.referencePosition.value.setFromMatrixPosition(v.matrixWorld),m.nearDistance.value=v.shadow.camera.near,m.farDistance.value=v.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:i}}function _g(r,e,t,n){let i={},s={},a=[];const o=r.getParameter(r.MAX_UNIFORM_BUFFER_BINDINGS);function l(v,y){const E=y.program;n.uniformBlockBinding(v,E)}function c(v,y){let E=i[v.id];E===void 0&&(_(v),E=u(v),i[v.id]=E,v.addEventListener("dispose",m));const R=y.program;n.updateUBOMapping(v,R);const T=e.render.frame;s[v.id]!==T&&(d(v),s[v.id]=T)}function u(v){const y=h();v.__bindingPointIndex=y;const E=r.createBuffer(),R=v.__size,T=v.usage;return r.bindBuffer(r.UNIFORM_BUFFER,E),r.bufferData(r.UNIFORM_BUFFER,R,T),r.bindBuffer(r.UNIFORM_BUFFER,null),r.bindBufferBase(r.UNIFORM_BUFFER,y,E),E}function h(){for(let v=0;v<o;v++)if(a.indexOf(v)===-1)return a.push(v),v;return Te("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(v){const y=i[v.id],E=v.uniforms,R=v.__cache;r.bindBuffer(r.UNIFORM_BUFFER,y);for(let T=0,L=E.length;T<L;T++){const x=Array.isArray(E[T])?E[T]:[E[T]];for(let b=0,V=x.length;b<V;b++){const C=x[b];if(f(C,T,b,R)===!0){const D=C.__offset,U=Array.isArray(C.value)?C.value:[C.value];let H=0;for(let G=0;G<U.length;G++){const B=U[G],z=g(B);typeof B=="number"||typeof B=="boolean"?(C.__data[0]=B,r.bufferSubData(r.UNIFORM_BUFFER,D+H,C.__data)):B.isMatrix3?(C.__data[0]=B.elements[0],C.__data[1]=B.elements[1],C.__data[2]=B.elements[2],C.__data[3]=0,C.__data[4]=B.elements[3],C.__data[5]=B.elements[4],C.__data[6]=B.elements[5],C.__data[7]=0,C.__data[8]=B.elements[6],C.__data[9]=B.elements[7],C.__data[10]=B.elements[8],C.__data[11]=0):(B.toArray(C.__data,H),H+=z.storage/Float32Array.BYTES_PER_ELEMENT)}r.bufferSubData(r.UNIFORM_BUFFER,D,C.__data)}}}r.bindBuffer(r.UNIFORM_BUFFER,null)}function f(v,y,E,R){const T=v.value,L=y+"_"+E;if(R[L]===void 0)return typeof T=="number"||typeof T=="boolean"?R[L]=T:R[L]=T.clone(),!0;{const x=R[L];if(typeof T=="number"||typeof T=="boolean"){if(x!==T)return R[L]=T,!0}else if(x.equals(T)===!1)return x.copy(T),!0}return!1}function _(v){const y=v.uniforms;let E=0;const R=16;for(let L=0,x=y.length;L<x;L++){const b=Array.isArray(y[L])?y[L]:[y[L]];for(let V=0,C=b.length;V<C;V++){const D=b[V],U=Array.isArray(D.value)?D.value:[D.value];for(let H=0,G=U.length;H<G;H++){const B=U[H],z=g(B),$=E%R,Y=$%z.boundary,ce=$+Y;E+=Y,ce!==0&&R-ce<z.storage&&(E+=R-ce),D.__data=new Float32Array(z.storage/Float32Array.BYTES_PER_ELEMENT),D.__offset=E,E+=z.storage}}}const T=E%R;return T>0&&(E+=R-T),v.__size=E,v.__cache={},this}function g(v){const y={boundary:0,storage:0};return typeof v=="number"||typeof v=="boolean"?(y.boundary=4,y.storage=4):v.isVector2?(y.boundary=8,y.storage=8):v.isVector3||v.isColor?(y.boundary=16,y.storage=12):v.isVector4?(y.boundary=16,y.storage=16):v.isMatrix3?(y.boundary=48,y.storage=48):v.isMatrix4?(y.boundary=64,y.storage=64):v.isTexture?ye("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ye("WebGLRenderer: Unsupported uniform value type.",v),y}function m(v){const y=v.target;y.removeEventListener("dispose",m);const E=a.indexOf(y.__bindingPointIndex);a.splice(E,1),r.deleteBuffer(i[y.id]),delete i[y.id],delete s[y.id]}function p(){for(const v in i)r.deleteBuffer(i[v]);a=[],i={},s={}}return{bind:l,update:c,dispose:p}}const gg=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);let dn=null;function Mg(){return dn===null&&(dn=new Yo(gg,16,16,Ki,Hn),dn.name="DFG_LUT",dn.minFilter=vt,dn.magFilter=vt,dn.wrapS=pn,dn.wrapT=pn,dn.generateMipmaps=!1,dn.needsUpdate=!0),dn}class OM{constructor(e={}){const{canvas:t=Vd(),context:n=null,depth:i=!0,stencil:s=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:u="default",failIfMajorPerformanceCaveat:h=!1,reversedDepthBuffer:d=!1,outputBufferType:f=Wt}=e;this.isWebGLRenderer=!0;let _;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");_=n.getContextAttributes().alpha}else _=a;const g=f,m=new Set([Go,Ho,zo]),p=new Set([Wt,xn,br,Ar,Fo,Bo]),v=new Uint32Array(4),y=new Int32Array(4);let E=null,R=null;const T=[],L=[];let x=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=gn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const b=this;let V=!1;this._outputColorSpace=dt;let C=0,D=0,U=null,H=-1,G=null;const B=new lt,z=new lt;let $=null;const Y=new Le(0);let ce=0,pe=t.width,de=t.height,Fe=1,ct=null,ot=null;const j=new lt(0,0,pe,de),ne=new lt(0,0,pe,de);let se=!1;const De=new ws;let Re=!1,we=!1;const At=new Ne,Ke=new I,Qe=new lt,nt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let ke=!1;function ft(){return U===null?Fe:1}let w=n;function gt(S,O){return t.getContext(S,O)}try{const S={alpha:!0,depth:i,stencil:s,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:u,failIfMajorPerformanceCaveat:h};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${Oo}`),t.addEventListener("webglcontextlost",ge,!1),t.addEventListener("webglcontextrestored",Pe,!1),t.addEventListener("webglcontextcreationerror",st,!1),w===null){const O="webgl2";if(w=gt(O,S),w===null)throw gt(O)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(S){throw Te("WebGLRenderer: "+S.message),S}let je,rt,Se,A,M,N,q,Q,K,me,ie,Ae,Ce,Z,ee,_e,Me,ue,ze,P,re,te,fe;function J(){je=new x_(w),je.init(),re=new cg(w,je),rt=new d_(w,je,e,re),Se=new og(w,je),rt.reversedDepthBuffer&&d&&Se.buffers.depth.setReversed(!0),A=new E_(w),M=new q0,N=new lg(w,je,Se,M,rt,re,A),q=new M_(b),Q=new Rf(w),te=new c_(w,Q),K=new S_(w,Q,A,te),me=new b_(w,K,Q,te,A),ue=new y_(w,rt,N),ee=new h_(M),ie=new K0(b,q,je,rt,te,ee),Ae=new mg(b,M),Ce=new Q0,Z=new tg(je),Me=new l_(b,q,Se,me,_,l),_e=new ag(b,me,rt),fe=new _g(w,A,rt,Se),ze=new u_(w,je,A),P=new v_(w,je,A),A.programs=ie.programs,b.capabilities=rt,b.extensions=je,b.properties=M,b.renderLists=Ce,b.shadowMap=_e,b.state=Se,b.info=A}J(),g!==Wt&&(x=new T_(g,t.width,t.height,i,s));const X=new fg(b,w);this.xr=X,this.getContext=function(){return w},this.getContextAttributes=function(){return w.getContextAttributes()},this.forceContextLoss=function(){const S=je.get("WEBGL_lose_context");S&&S.loseContext()},this.forceContextRestore=function(){const S=je.get("WEBGL_lose_context");S&&S.restoreContext()},this.getPixelRatio=function(){return Fe},this.setPixelRatio=function(S){S!==void 0&&(Fe=S,this.setSize(pe,de,!1))},this.getSize=function(S){return S.set(pe,de)},this.setSize=function(S,O,W=!0){if(X.isPresenting){ye("WebGLRenderer: Can't change size while VR device is presenting.");return}pe=S,de=O,t.width=Math.floor(S*Fe),t.height=Math.floor(O*Fe),W===!0&&(t.style.width=S+"px",t.style.height=O+"px"),x!==null&&x.setSize(t.width,t.height),this.setViewport(0,0,S,O)},this.getDrawingBufferSize=function(S){return S.set(pe*Fe,de*Fe).floor()},this.setDrawingBufferSize=function(S,O,W){pe=S,de=O,Fe=W,t.width=Math.floor(S*W),t.height=Math.floor(O*W),this.setViewport(0,0,S,O)},this.setEffects=function(S){if(g===Wt){console.error("THREE.WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(S){for(let O=0;O<S.length;O++)if(S[O].isOutputPass===!0){console.warn("THREE.WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}x.setEffects(S||[])},this.getCurrentViewport=function(S){return S.copy(B)},this.getViewport=function(S){return S.copy(j)},this.setViewport=function(S,O,W,k){S.isVector4?j.set(S.x,S.y,S.z,S.w):j.set(S,O,W,k),Se.viewport(B.copy(j).multiplyScalar(Fe).round())},this.getScissor=function(S){return S.copy(ne)},this.setScissor=function(S,O,W,k){S.isVector4?ne.set(S.x,S.y,S.z,S.w):ne.set(S,O,W,k),Se.scissor(z.copy(ne).multiplyScalar(Fe).round())},this.getScissorTest=function(){return se},this.setScissorTest=function(S){Se.setScissorTest(se=S)},this.setOpaqueSort=function(S){ct=S},this.setTransparentSort=function(S){ot=S},this.getClearColor=function(S){return S.copy(Me.getClearColor())},this.setClearColor=function(){Me.setClearColor(...arguments)},this.getClearAlpha=function(){return Me.getClearAlpha()},this.setClearAlpha=function(){Me.setClearAlpha(...arguments)},this.clear=function(S=!0,O=!0,W=!0){let k=0;if(S){let F=!1;if(U!==null){const oe=U.texture.format;F=m.has(oe)}if(F){const oe=U.texture.type,he=p.has(oe),le=Me.getClearColor(),xe=Me.getClearAlpha(),Ee=le.r,Oe=le.g,He=le.b;he?(v[0]=Ee,v[1]=Oe,v[2]=He,v[3]=xe,w.clearBufferuiv(w.COLOR,0,v)):(y[0]=Ee,y[1]=Oe,y[2]=He,y[3]=xe,w.clearBufferiv(w.COLOR,0,y))}else k|=w.COLOR_BUFFER_BIT}O&&(k|=w.DEPTH_BUFFER_BIT),W&&(k|=w.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),k!==0&&w.clear(k)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",ge,!1),t.removeEventListener("webglcontextrestored",Pe,!1),t.removeEventListener("webglcontextcreationerror",st,!1),Me.dispose(),Ce.dispose(),Z.dispose(),M.dispose(),q.dispose(),me.dispose(),te.dispose(),fe.dispose(),ie.dispose(),X.dispose(),X.removeEventListener("sessionstart",ol),X.removeEventListener("sessionend",ll),ti.stop()};function ge(S){S.preventDefault(),ys("WebGLRenderer: Context Lost."),V=!0}function Pe(){ys("WebGLRenderer: Context Restored."),V=!1;const S=A.autoReset,O=_e.enabled,W=_e.autoUpdate,k=_e.needsUpdate,F=_e.type;J(),A.autoReset=S,_e.enabled=O,_e.autoUpdate=W,_e.needsUpdate=k,_e.type=F}function st(S){Te("WebGLRenderer: A WebGL context could not be created. Reason: ",S.statusMessage)}function Ye(S){const O=S.target;O.removeEventListener("dispose",Ye),yn(O)}function yn(S){bn(S),M.remove(S)}function bn(S){const O=M.get(S).programs;O!==void 0&&(O.forEach(function(W){ie.releaseProgram(W)}),S.isShaderMaterial&&ie.releaseShaderCache(S))}this.renderBufferDirect=function(S,O,W,k,F,oe){O===null&&(O=nt);const he=F.isMesh&&F.matrixWorld.determinant()<0,le=ed(S,O,W,k,F);Se.setMaterial(k,he);let xe=W.index,Ee=1;if(k.wireframe===!0){if(xe=K.getWireframeAttribute(W),xe===void 0)return;Ee=2}const Oe=W.drawRange,He=W.attributes.position;let be=Oe.start*Ee,et=(Oe.start+Oe.count)*Ee;oe!==null&&(be=Math.max(be,oe.start*Ee),et=Math.min(et,(oe.start+oe.count)*Ee)),xe!==null?(be=Math.max(be,0),et=Math.min(et,xe.count)):He!=null&&(be=Math.max(be,0),et=Math.min(et,He.count));const pt=et-be;if(pt<0||pt===1/0)return;te.setup(F,k,le,W,xe);let ht,tt=ze;if(xe!==null&&(ht=Q.get(xe),tt=P,tt.setIndex(ht)),F.isMesh)k.wireframe===!0?(Se.setLineWidth(k.wireframeLinewidth*ft()),tt.setMode(w.LINES)):tt.setMode(w.TRIANGLES);else if(F.isLine){let It=k.linewidth;It===void 0&&(It=1),Se.setLineWidth(It*ft()),F.isLineSegments?tt.setMode(w.LINES):F.isLineLoop?tt.setMode(w.LINE_LOOP):tt.setMode(w.LINE_STRIP)}else F.isPoints?tt.setMode(w.POINTS):F.isSprite&&tt.setMode(w.TRIANGLES);if(F.isBatchedMesh)if(F._multiDrawInstances!==null)bs("WebGLRenderer: renderMultiDrawInstances has been deprecated and will be removed in r184. Append to renderMultiDraw arguments and use indirection."),tt.renderMultiDrawInstances(F._multiDrawStarts,F._multiDrawCounts,F._multiDrawCount,F._multiDrawInstances);else if(je.get("WEBGL_multi_draw"))tt.renderMultiDraw(F._multiDrawStarts,F._multiDrawCounts,F._multiDrawCount);else{const It=F._multiDrawStarts,ve=F._multiDrawCounts,Ht=F._multiDrawCount,qe=xe?Q.get(xe).bytesPerElement:1,Jt=M.get(k).currentProgram.getUniforms();for(let cn=0;cn<Ht;cn++)Jt.setValue(w,"_gl_DrawID",cn),tt.render(It[cn]/qe,ve[cn])}else if(F.isInstancedMesh)tt.renderInstances(be,pt,F.count);else if(W.isInstancedBufferGeometry){const It=W._maxInstanceCount!==void 0?W._maxInstanceCount:1/0,ve=Math.min(W.instanceCount,It);tt.renderInstances(be,pt,ve)}else tt.render(be,pt)};function al(S,O,W){S.transparent===!0&&S.side===nn&&S.forceSinglePass===!1?(S.side=zt,S.needsUpdate=!0,Ur(S,O,W),S.side=zn,S.needsUpdate=!0,Ur(S,O,W),S.side=nn):Ur(S,O,W)}this.compile=function(S,O,W=null){W===null&&(W=S),R=Z.get(W),R.init(O),L.push(R),W.traverseVisible(function(F){F.isLight&&F.layers.test(O.layers)&&(R.pushLight(F),F.castShadow&&R.pushShadow(F))}),S!==W&&S.traverseVisible(function(F){F.isLight&&F.layers.test(O.layers)&&(R.pushLight(F),F.castShadow&&R.pushShadow(F))}),R.setupLights();const k=new Set;return S.traverse(function(F){if(!(F.isMesh||F.isPoints||F.isLine||F.isSprite))return;const oe=F.material;if(oe)if(Array.isArray(oe))for(let he=0;he<oe.length;he++){const le=oe[he];al(le,W,F),k.add(le)}else al(oe,W,F),k.add(oe)}),R=L.pop(),k},this.compileAsync=function(S,O,W=null){const k=this.compile(S,O,W);return new Promise(F=>{function oe(){if(k.forEach(function(he){M.get(he).currentProgram.isReady()&&k.delete(he)}),k.size===0){F(S);return}setTimeout(oe,10)}je.get("KHR_parallel_shader_compile")!==null?oe():setTimeout(oe,10)})};let zs=null;function $u(S){zs&&zs(S)}function ol(){ti.stop()}function ll(){ti.start()}const ti=new Bu;ti.setAnimationLoop($u),typeof self<"u"&&ti.setContext(self),this.setAnimationLoop=function(S){zs=S,X.setAnimationLoop(S),S===null?ti.stop():ti.start()},X.addEventListener("sessionstart",ol),X.addEventListener("sessionend",ll),this.render=function(S,O){if(O!==void 0&&O.isCamera!==!0){Te("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(V===!0)return;const W=X.enabled===!0&&X.isPresenting===!0,k=x!==null&&(U===null||W)&&x.begin(b,U);if(S.matrixWorldAutoUpdate===!0&&S.updateMatrixWorld(),O.parent===null&&O.matrixWorldAutoUpdate===!0&&O.updateMatrixWorld(),X.enabled===!0&&X.isPresenting===!0&&(x===null||x.isCompositing()===!1)&&(X.cameraAutoUpdate===!0&&X.updateCamera(O),O=X.getCamera()),S.isScene===!0&&S.onBeforeRender(b,S,O,U),R=Z.get(S,L.length),R.init(O),L.push(R),At.multiplyMatrices(O.projectionMatrix,O.matrixWorldInverse),De.setFromProjectionMatrix(At,mn,O.reversedDepth),we=this.localClippingEnabled,Re=ee.init(this.clippingPlanes,we),E=Ce.get(S,T.length),E.init(),T.push(E),X.enabled===!0&&X.isPresenting===!0){const he=b.xr.getDepthSensingMesh();he!==null&&Hs(he,O,-1/0,b.sortObjects)}Hs(S,O,0,b.sortObjects),E.finish(),b.sortObjects===!0&&E.sort(ct,ot),ke=X.enabled===!1||X.isPresenting===!1||X.hasDepthSensing()===!1,ke&&Me.addToRenderList(E,S),this.info.render.frame++,Re===!0&&ee.beginShadows();const F=R.state.shadowsArray;if(_e.render(F,S,O),Re===!0&&ee.endShadows(),this.info.autoReset===!0&&this.info.reset(),(k&&x.hasRenderPass())===!1){const he=E.opaque,le=E.transmissive;if(R.setupLights(),O.isArrayCamera){const xe=O.cameras;if(le.length>0)for(let Ee=0,Oe=xe.length;Ee<Oe;Ee++){const He=xe[Ee];ul(he,le,S,He)}ke&&Me.render(S);for(let Ee=0,Oe=xe.length;Ee<Oe;Ee++){const He=xe[Ee];cl(E,S,He,He.viewport)}}else le.length>0&&ul(he,le,S,O),ke&&Me.render(S),cl(E,S,O)}U!==null&&D===0&&(N.updateMultisampleRenderTarget(U),N.updateRenderTargetMipmap(U)),k&&x.end(b),S.isScene===!0&&S.onAfterRender(b,S,O),te.resetDefaultState(),H=-1,G=null,L.pop(),L.length>0?(R=L[L.length-1],Re===!0&&ee.setGlobalState(b.clippingPlanes,R.state.camera)):R=null,T.pop(),T.length>0?E=T[T.length-1]:E=null};function Hs(S,O,W,k){if(S.visible===!1)return;if(S.layers.test(O.layers)){if(S.isGroup)W=S.renderOrder;else if(S.isLOD)S.autoUpdate===!0&&S.update(O);else if(S.isLight)R.pushLight(S),S.castShadow&&R.pushShadow(S);else if(S.isSprite){if(!S.frustumCulled||De.intersectsSprite(S)){k&&Qe.setFromMatrixPosition(S.matrixWorld).applyMatrix4(At);const he=me.update(S),le=S.material;le.visible&&E.push(S,he,le,W,Qe.z,null)}}else if((S.isMesh||S.isLine||S.isPoints)&&(!S.frustumCulled||De.intersectsObject(S))){const he=me.update(S),le=S.material;if(k&&(S.boundingSphere!==void 0?(S.boundingSphere===null&&S.computeBoundingSphere(),Qe.copy(S.boundingSphere.center)):(he.boundingSphere===null&&he.computeBoundingSphere(),Qe.copy(he.boundingSphere.center)),Qe.applyMatrix4(S.matrixWorld).applyMatrix4(At)),Array.isArray(le)){const xe=he.groups;for(let Ee=0,Oe=xe.length;Ee<Oe;Ee++){const He=xe[Ee],be=le[He.materialIndex];be&&be.visible&&E.push(S,he,be,W,Qe.z,He)}}else le.visible&&E.push(S,he,le,W,Qe.z,null)}}const oe=S.children;for(let he=0,le=oe.length;he<le;he++)Hs(oe[he],O,W,k)}function cl(S,O,W,k){const{opaque:F,transmissive:oe,transparent:he}=S;R.setupLightsView(W),Re===!0&&ee.setGlobalState(b.clippingPlanes,W),k&&Se.viewport(B.copy(k)),F.length>0&&Dr(F,O,W),oe.length>0&&Dr(oe,O,W),he.length>0&&Dr(he,O,W),Se.buffers.depth.setTest(!0),Se.buffers.depth.setMask(!0),Se.buffers.color.setMask(!0),Se.setPolygonOffset(!1)}function ul(S,O,W,k){if((W.isScene===!0?W.overrideMaterial:null)!==null)return;if(R.state.transmissionRenderTarget[k.id]===void 0){const be=je.has("EXT_color_buffer_half_float")||je.has("EXT_color_buffer_float");R.state.transmissionRenderTarget[k.id]=new Mn(1,1,{generateMipmaps:!0,type:be?Hn:Wt,minFilter:On,samples:Math.max(4,rt.samples),stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Xe.workingColorSpace})}const oe=R.state.transmissionRenderTarget[k.id],he=k.viewport||B;oe.setSize(he.z*b.transmissionResolutionScale,he.w*b.transmissionResolutionScale);const le=b.getRenderTarget(),xe=b.getActiveCubeFace(),Ee=b.getActiveMipmapLevel();b.setRenderTarget(oe),b.getClearColor(Y),ce=b.getClearAlpha(),ce<1&&b.setClearColor(16777215,.5),b.clear(),ke&&Me.render(W);const Oe=b.toneMapping;b.toneMapping=gn;const He=k.viewport;if(k.viewport!==void 0&&(k.viewport=void 0),R.setupLightsView(k),Re===!0&&ee.setGlobalState(b.clippingPlanes,k),Dr(S,W,k),N.updateMultisampleRenderTarget(oe),N.updateRenderTargetMipmap(oe),je.has("WEBGL_multisampled_render_to_texture")===!1){let be=!1;for(let et=0,pt=O.length;et<pt;et++){const ht=O[et],{object:tt,geometry:It,material:ve,group:Ht}=ht;if(ve.side===nn&&tt.layers.test(k.layers)){const qe=ve.side;ve.side=zt,ve.needsUpdate=!0,dl(tt,W,k,It,ve,Ht),ve.side=qe,ve.needsUpdate=!0,be=!0}}be===!0&&(N.updateMultisampleRenderTarget(oe),N.updateRenderTargetMipmap(oe))}b.setRenderTarget(le,xe,Ee),b.setClearColor(Y,ce),He!==void 0&&(k.viewport=He),b.toneMapping=Oe}function Dr(S,O,W){const k=O.isScene===!0?O.overrideMaterial:null;for(let F=0,oe=S.length;F<oe;F++){const he=S[F],{object:le,geometry:xe,group:Ee}=he;let Oe=he.material;Oe.allowOverride===!0&&k!==null&&(Oe=k),le.layers.test(W.layers)&&dl(le,O,W,xe,Oe,Ee)}}function dl(S,O,W,k,F,oe){S.onBeforeRender(b,O,W,k,F,oe),S.modelViewMatrix.multiplyMatrices(W.matrixWorldInverse,S.matrixWorld),S.normalMatrix.getNormalMatrix(S.modelViewMatrix),F.onBeforeRender(b,O,W,k,S,oe),F.transparent===!0&&F.side===nn&&F.forceSinglePass===!1?(F.side=zt,F.needsUpdate=!0,b.renderBufferDirect(W,O,k,F,S,oe),F.side=zn,F.needsUpdate=!0,b.renderBufferDirect(W,O,k,F,S,oe),F.side=nn):b.renderBufferDirect(W,O,k,F,S,oe),S.onAfterRender(b,O,W,k,F,oe)}function Ur(S,O,W){O.isScene!==!0&&(O=nt);const k=M.get(S),F=R.state.lights,oe=R.state.shadowsArray,he=F.state.version,le=ie.getParameters(S,F.state,oe,O,W),xe=ie.getProgramCacheKey(le);let Ee=k.programs;k.environment=S.isMeshStandardMaterial||S.isMeshLambertMaterial||S.isMeshPhongMaterial?O.environment:null,k.fog=O.fog;const Oe=S.isMeshStandardMaterial||S.isMeshLambertMaterial&&!S.envMap||S.isMeshPhongMaterial&&!S.envMap;k.envMap=q.get(S.envMap||k.environment,Oe),k.envMapRotation=k.environment!==null&&S.envMap===null?O.environmentRotation:S.envMapRotation,Ee===void 0&&(S.addEventListener("dispose",Ye),Ee=new Map,k.programs=Ee);let He=Ee.get(xe);if(He!==void 0){if(k.currentProgram===He&&k.lightsStateVersion===he)return fl(S,le),He}else le.uniforms=ie.getUniforms(S),S.onBeforeCompile(le,b),He=ie.acquireProgram(le,xe),Ee.set(xe,He),k.uniforms=le.uniforms;const be=k.uniforms;return(!S.isShaderMaterial&&!S.isRawShaderMaterial||S.clipping===!0)&&(be.clippingPlanes=ee.uniform),fl(S,le),k.needsLights=nd(S),k.lightsStateVersion=he,k.needsLights&&(be.ambientLightColor.value=F.state.ambient,be.lightProbe.value=F.state.probe,be.directionalLights.value=F.state.directional,be.directionalLightShadows.value=F.state.directionalShadow,be.spotLights.value=F.state.spot,be.spotLightShadows.value=F.state.spotShadow,be.rectAreaLights.value=F.state.rectArea,be.ltc_1.value=F.state.rectAreaLTC1,be.ltc_2.value=F.state.rectAreaLTC2,be.pointLights.value=F.state.point,be.pointLightShadows.value=F.state.pointShadow,be.hemisphereLights.value=F.state.hemi,be.directionalShadowMatrix.value=F.state.directionalShadowMatrix,be.spotLightMatrix.value=F.state.spotLightMatrix,be.spotLightMap.value=F.state.spotLightMap,be.pointShadowMatrix.value=F.state.pointShadowMatrix),k.currentProgram=He,k.uniformsList=null,He}function hl(S){if(S.uniformsList===null){const O=S.currentProgram.getUniforms();S.uniformsList=Ss.seqWithValue(O.seq,S.uniforms)}return S.uniformsList}function fl(S,O){const W=M.get(S);W.outputColorSpace=O.outputColorSpace,W.batching=O.batching,W.batchingColor=O.batchingColor,W.instancing=O.instancing,W.instancingColor=O.instancingColor,W.instancingMorph=O.instancingMorph,W.skinning=O.skinning,W.morphTargets=O.morphTargets,W.morphNormals=O.morphNormals,W.morphColors=O.morphColors,W.morphTargetsCount=O.morphTargetsCount,W.numClippingPlanes=O.numClippingPlanes,W.numIntersection=O.numClipIntersection,W.vertexAlphas=O.vertexAlphas,W.vertexTangents=O.vertexTangents,W.toneMapping=O.toneMapping}function ed(S,O,W,k,F){O.isScene!==!0&&(O=nt),N.resetTextureUnits();const oe=O.fog,he=k.isMeshStandardMaterial||k.isMeshLambertMaterial||k.isMeshPhongMaterial?O.environment:null,le=U===null?b.outputColorSpace:U.isXRRenderTarget===!0?U.texture.colorSpace:Dt,xe=k.isMeshStandardMaterial||k.isMeshLambertMaterial&&!k.envMap||k.isMeshPhongMaterial&&!k.envMap,Ee=q.get(k.envMap||he,xe),Oe=k.vertexColors===!0&&!!W.attributes.color&&W.attributes.color.itemSize===4,He=!!W.attributes.tangent&&(!!k.normalMap||k.anisotropy>0),be=!!W.morphAttributes.position,et=!!W.morphAttributes.normal,pt=!!W.morphAttributes.color;let ht=gn;k.toneMapped&&(U===null||U.isXRRenderTarget===!0)&&(ht=b.toneMapping);const tt=W.morphAttributes.position||W.morphAttributes.normal||W.morphAttributes.color,It=tt!==void 0?tt.length:0,ve=M.get(k),Ht=R.state.lights;if(Re===!0&&(we===!0||S!==G)){const Tt=S===G&&k.id===H;ee.setState(k,S,Tt)}let qe=!1;k.version===ve.__version?(ve.needsLights&&ve.lightsStateVersion!==Ht.state.version||ve.outputColorSpace!==le||F.isBatchedMesh&&ve.batching===!1||!F.isBatchedMesh&&ve.batching===!0||F.isBatchedMesh&&ve.batchingColor===!0&&F.colorTexture===null||F.isBatchedMesh&&ve.batchingColor===!1&&F.colorTexture!==null||F.isInstancedMesh&&ve.instancing===!1||!F.isInstancedMesh&&ve.instancing===!0||F.isSkinnedMesh&&ve.skinning===!1||!F.isSkinnedMesh&&ve.skinning===!0||F.isInstancedMesh&&ve.instancingColor===!0&&F.instanceColor===null||F.isInstancedMesh&&ve.instancingColor===!1&&F.instanceColor!==null||F.isInstancedMesh&&ve.instancingMorph===!0&&F.morphTexture===null||F.isInstancedMesh&&ve.instancingMorph===!1&&F.morphTexture!==null||ve.envMap!==Ee||k.fog===!0&&ve.fog!==oe||ve.numClippingPlanes!==void 0&&(ve.numClippingPlanes!==ee.numPlanes||ve.numIntersection!==ee.numIntersection)||ve.vertexAlphas!==Oe||ve.vertexTangents!==He||ve.morphTargets!==be||ve.morphNormals!==et||ve.morphColors!==pt||ve.toneMapping!==ht||ve.morphTargetsCount!==It)&&(qe=!0):(qe=!0,ve.__version=k.version);let Jt=ve.currentProgram;qe===!0&&(Jt=Ur(k,O,F));let cn=!1,ni=!1,Mi=!1;const it=Jt.getUniforms(),Ct=ve.uniforms;if(Se.useProgram(Jt.program)&&(cn=!0,ni=!0,Mi=!0),k.id!==H&&(H=k.id,ni=!0),cn||G!==S){Se.buffers.depth.getReversed()&&S.reversedDepth!==!0&&(S._reversedDepth=!0,S.updateProjectionMatrix()),it.setValue(w,"projectionMatrix",S.projectionMatrix),it.setValue(w,"viewMatrix",S.matrixWorldInverse);const Xn=it.map.cameraPosition;Xn!==void 0&&Xn.setValue(w,Ke.setFromMatrixPosition(S.matrixWorld)),rt.logarithmicDepthBuffer&&it.setValue(w,"logDepthBufFC",2/(Math.log(S.far+1)/Math.LN2)),(k.isMeshPhongMaterial||k.isMeshToonMaterial||k.isMeshLambertMaterial||k.isMeshBasicMaterial||k.isMeshStandardMaterial||k.isShaderMaterial)&&it.setValue(w,"isOrthographic",S.isOrthographicCamera===!0),G!==S&&(G=S,ni=!0,Mi=!0)}if(ve.needsLights&&(Ht.state.directionalShadowMap.length>0&&it.setValue(w,"directionalShadowMap",Ht.state.directionalShadowMap,N),Ht.state.spotShadowMap.length>0&&it.setValue(w,"spotShadowMap",Ht.state.spotShadowMap,N),Ht.state.pointShadowMap.length>0&&it.setValue(w,"pointShadowMap",Ht.state.pointShadowMap,N)),F.isSkinnedMesh){it.setOptional(w,F,"bindMatrix"),it.setOptional(w,F,"bindMatrixInverse");const Tt=F.skeleton;Tt&&(Tt.boneTexture===null&&Tt.computeBoneTexture(),it.setValue(w,"boneTexture",Tt.boneTexture,N))}F.isBatchedMesh&&(it.setOptional(w,F,"batchingTexture"),it.setValue(w,"batchingTexture",F._matricesTexture,N),it.setOptional(w,F,"batchingIdTexture"),it.setValue(w,"batchingIdTexture",F._indirectTexture,N),it.setOptional(w,F,"batchingColorTexture"),F._colorsTexture!==null&&it.setValue(w,"batchingColorTexture",F._colorsTexture,N));const Wn=W.morphAttributes;if((Wn.position!==void 0||Wn.normal!==void 0||Wn.color!==void 0)&&ue.update(F,W,Jt),(ni||ve.receiveShadow!==F.receiveShadow)&&(ve.receiveShadow=F.receiveShadow,it.setValue(w,"receiveShadow",F.receiveShadow)),(k.isMeshStandardMaterial||k.isMeshLambertMaterial||k.isMeshPhongMaterial)&&k.envMap===null&&O.environment!==null&&(Ct.envMapIntensity.value=O.environmentIntensity),Ct.dfgLUT!==void 0&&(Ct.dfgLUT.value=Mg()),ni&&(it.setValue(w,"toneMappingExposure",b.toneMappingExposure),ve.needsLights&&td(Ct,Mi),oe&&k.fog===!0&&Ae.refreshFogUniforms(Ct,oe),Ae.refreshMaterialUniforms(Ct,k,Fe,de,R.state.transmissionRenderTarget[S.id]),Ss.upload(w,hl(ve),Ct,N)),k.isShaderMaterial&&k.uniformsNeedUpdate===!0&&(Ss.upload(w,hl(ve),Ct,N),k.uniformsNeedUpdate=!1),k.isSpriteMaterial&&it.setValue(w,"center",F.center),it.setValue(w,"modelViewMatrix",F.modelViewMatrix),it.setValue(w,"normalMatrix",F.normalMatrix),it.setValue(w,"modelMatrix",F.matrixWorld),k.isShaderMaterial||k.isRawShaderMaterial){const Tt=k.uniformsGroups;for(let Xn=0,xi=Tt.length;Xn<xi;Xn++){const pl=Tt[Xn];fe.update(pl,Jt),fe.bind(pl,Jt)}}return Jt}function td(S,O){S.ambientLightColor.needsUpdate=O,S.lightProbe.needsUpdate=O,S.directionalLights.needsUpdate=O,S.directionalLightShadows.needsUpdate=O,S.pointLights.needsUpdate=O,S.pointLightShadows.needsUpdate=O,S.spotLights.needsUpdate=O,S.spotLightShadows.needsUpdate=O,S.rectAreaLights.needsUpdate=O,S.hemisphereLights.needsUpdate=O}function nd(S){return S.isMeshLambertMaterial||S.isMeshToonMaterial||S.isMeshPhongMaterial||S.isMeshStandardMaterial||S.isShadowMaterial||S.isShaderMaterial&&S.lights===!0}this.getActiveCubeFace=function(){return C},this.getActiveMipmapLevel=function(){return D},this.getRenderTarget=function(){return U},this.setRenderTargetTextures=function(S,O,W){const k=M.get(S);k.__autoAllocateDepthBuffer=S.resolveDepthBuffer===!1,k.__autoAllocateDepthBuffer===!1&&(k.__useRenderToTexture=!1),M.get(S.texture).__webglTexture=O,M.get(S.depthTexture).__webglTexture=k.__autoAllocateDepthBuffer?void 0:W,k.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(S,O){const W=M.get(S);W.__webglFramebuffer=O,W.__useDefaultFramebuffer=O===void 0};const id=w.createFramebuffer();this.setRenderTarget=function(S,O=0,W=0){U=S,C=O,D=W;let k=null,F=!1,oe=!1;if(S){const le=M.get(S);if(le.__useDefaultFramebuffer!==void 0){Se.bindFramebuffer(w.FRAMEBUFFER,le.__webglFramebuffer),B.copy(S.viewport),z.copy(S.scissor),$=S.scissorTest,Se.viewport(B),Se.scissor(z),Se.setScissorTest($),H=-1;return}else if(le.__webglFramebuffer===void 0)N.setupRenderTarget(S);else if(le.__hasExternalTextures)N.rebindTextures(S,M.get(S.texture).__webglTexture,M.get(S.depthTexture).__webglTexture);else if(S.depthBuffer){const Oe=S.depthTexture;if(le.__boundDepthTexture!==Oe){if(Oe!==null&&M.has(Oe)&&(S.width!==Oe.image.width||S.height!==Oe.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");N.setupDepthRenderbuffer(S)}}const xe=S.texture;(xe.isData3DTexture||xe.isDataArrayTexture||xe.isCompressedArrayTexture)&&(oe=!0);const Ee=M.get(S).__webglFramebuffer;S.isWebGLCubeRenderTarget?(Array.isArray(Ee[O])?k=Ee[O][W]:k=Ee[O],F=!0):S.samples>0&&N.useMultisampledRTT(S)===!1?k=M.get(S).__webglMultisampledFramebuffer:Array.isArray(Ee)?k=Ee[W]:k=Ee,B.copy(S.viewport),z.copy(S.scissor),$=S.scissorTest}else B.copy(j).multiplyScalar(Fe).floor(),z.copy(ne).multiplyScalar(Fe).floor(),$=se;if(W!==0&&(k=id),Se.bindFramebuffer(w.FRAMEBUFFER,k)&&Se.drawBuffers(S,k),Se.viewport(B),Se.scissor(z),Se.setScissorTest($),F){const le=M.get(S.texture);w.framebufferTexture2D(w.FRAMEBUFFER,w.COLOR_ATTACHMENT0,w.TEXTURE_CUBE_MAP_POSITIVE_X+O,le.__webglTexture,W)}else if(oe){const le=O;for(let xe=0;xe<S.textures.length;xe++){const Ee=M.get(S.textures[xe]);w.framebufferTextureLayer(w.FRAMEBUFFER,w.COLOR_ATTACHMENT0+xe,Ee.__webglTexture,W,le)}}else if(S!==null&&W!==0){const le=M.get(S.texture);w.framebufferTexture2D(w.FRAMEBUFFER,w.COLOR_ATTACHMENT0,w.TEXTURE_2D,le.__webglTexture,W)}H=-1},this.readRenderTargetPixels=function(S,O,W,k,F,oe,he,le=0){if(!(S&&S.isWebGLRenderTarget)){Te("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let xe=M.get(S).__webglFramebuffer;if(S.isWebGLCubeRenderTarget&&he!==void 0&&(xe=xe[he]),xe){Se.bindFramebuffer(w.FRAMEBUFFER,xe);try{const Ee=S.textures[le],Oe=Ee.format,He=Ee.type;if(S.textures.length>1&&w.readBuffer(w.COLOR_ATTACHMENT0+le),!rt.textureFormatReadable(Oe)){Te("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!rt.textureTypeReadable(He)){Te("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}O>=0&&O<=S.width-k&&W>=0&&W<=S.height-F&&w.readPixels(O,W,k,F,re.convert(Oe),re.convert(He),oe)}finally{const Ee=U!==null?M.get(U).__webglFramebuffer:null;Se.bindFramebuffer(w.FRAMEBUFFER,Ee)}}},this.readRenderTargetPixelsAsync=async function(S,O,W,k,F,oe,he,le=0){if(!(S&&S.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let xe=M.get(S).__webglFramebuffer;if(S.isWebGLCubeRenderTarget&&he!==void 0&&(xe=xe[he]),xe)if(O>=0&&O<=S.width-k&&W>=0&&W<=S.height-F){Se.bindFramebuffer(w.FRAMEBUFFER,xe);const Ee=S.textures[le],Oe=Ee.format,He=Ee.type;if(S.textures.length>1&&w.readBuffer(w.COLOR_ATTACHMENT0+le),!rt.textureFormatReadable(Oe))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!rt.textureTypeReadable(He))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const be=w.createBuffer();w.bindBuffer(w.PIXEL_PACK_BUFFER,be),w.bufferData(w.PIXEL_PACK_BUFFER,oe.byteLength,w.STREAM_READ),w.readPixels(O,W,k,F,re.convert(Oe),re.convert(He),0);const et=U!==null?M.get(U).__webglFramebuffer:null;Se.bindFramebuffer(w.FRAMEBUFFER,et);const pt=w.fenceSync(w.SYNC_GPU_COMMANDS_COMPLETE,0);return w.flush(),await Wd(w,pt,4),w.bindBuffer(w.PIXEL_PACK_BUFFER,be),w.getBufferSubData(w.PIXEL_PACK_BUFFER,0,oe),w.deleteBuffer(be),w.deleteSync(pt),oe}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(S,O=null,W=0){const k=Math.pow(2,-W),F=Math.floor(S.image.width*k),oe=Math.floor(S.image.height*k),he=O!==null?O.x:0,le=O!==null?O.y:0;N.setTexture2D(S,0),w.copyTexSubImage2D(w.TEXTURE_2D,W,0,0,he,le,F,oe),Se.unbindTexture()};const rd=w.createFramebuffer(),sd=w.createFramebuffer();this.copyTextureToTexture=function(S,O,W=null,k=null,F=0,oe=0){let he,le,xe,Ee,Oe,He,be,et,pt;const ht=S.isCompressedTexture?S.mipmaps[oe]:S.image;if(W!==null)he=W.max.x-W.min.x,le=W.max.y-W.min.y,xe=W.isBox3?W.max.z-W.min.z:1,Ee=W.min.x,Oe=W.min.y,He=W.isBox3?W.min.z:0;else{const Ct=Math.pow(2,-F);he=Math.floor(ht.width*Ct),le=Math.floor(ht.height*Ct),S.isDataArrayTexture?xe=ht.depth:S.isData3DTexture?xe=Math.floor(ht.depth*Ct):xe=1,Ee=0,Oe=0,He=0}k!==null?(be=k.x,et=k.y,pt=k.z):(be=0,et=0,pt=0);const tt=re.convert(O.format),It=re.convert(O.type);let ve;O.isData3DTexture?(N.setTexture3D(O,0),ve=w.TEXTURE_3D):O.isDataArrayTexture||O.isCompressedArrayTexture?(N.setTexture2DArray(O,0),ve=w.TEXTURE_2D_ARRAY):(N.setTexture2D(O,0),ve=w.TEXTURE_2D),w.pixelStorei(w.UNPACK_FLIP_Y_WEBGL,O.flipY),w.pixelStorei(w.UNPACK_PREMULTIPLY_ALPHA_WEBGL,O.premultiplyAlpha),w.pixelStorei(w.UNPACK_ALIGNMENT,O.unpackAlignment);const Ht=w.getParameter(w.UNPACK_ROW_LENGTH),qe=w.getParameter(w.UNPACK_IMAGE_HEIGHT),Jt=w.getParameter(w.UNPACK_SKIP_PIXELS),cn=w.getParameter(w.UNPACK_SKIP_ROWS),ni=w.getParameter(w.UNPACK_SKIP_IMAGES);w.pixelStorei(w.UNPACK_ROW_LENGTH,ht.width),w.pixelStorei(w.UNPACK_IMAGE_HEIGHT,ht.height),w.pixelStorei(w.UNPACK_SKIP_PIXELS,Ee),w.pixelStorei(w.UNPACK_SKIP_ROWS,Oe),w.pixelStorei(w.UNPACK_SKIP_IMAGES,He);const Mi=S.isDataArrayTexture||S.isData3DTexture,it=O.isDataArrayTexture||O.isData3DTexture;if(S.isDepthTexture){const Ct=M.get(S),Wn=M.get(O),Tt=M.get(Ct.__renderTarget),Xn=M.get(Wn.__renderTarget);Se.bindFramebuffer(w.READ_FRAMEBUFFER,Tt.__webglFramebuffer),Se.bindFramebuffer(w.DRAW_FRAMEBUFFER,Xn.__webglFramebuffer);for(let xi=0;xi<xe;xi++)Mi&&(w.framebufferTextureLayer(w.READ_FRAMEBUFFER,w.COLOR_ATTACHMENT0,M.get(S).__webglTexture,F,He+xi),w.framebufferTextureLayer(w.DRAW_FRAMEBUFFER,w.COLOR_ATTACHMENT0,M.get(O).__webglTexture,oe,pt+xi)),w.blitFramebuffer(Ee,Oe,he,le,be,et,he,le,w.DEPTH_BUFFER_BIT,w.NEAREST);Se.bindFramebuffer(w.READ_FRAMEBUFFER,null),Se.bindFramebuffer(w.DRAW_FRAMEBUFFER,null)}else if(F!==0||S.isRenderTargetTexture||M.has(S)){const Ct=M.get(S),Wn=M.get(O);Se.bindFramebuffer(w.READ_FRAMEBUFFER,rd),Se.bindFramebuffer(w.DRAW_FRAMEBUFFER,sd);for(let Tt=0;Tt<xe;Tt++)Mi?w.framebufferTextureLayer(w.READ_FRAMEBUFFER,w.COLOR_ATTACHMENT0,Ct.__webglTexture,F,He+Tt):w.framebufferTexture2D(w.READ_FRAMEBUFFER,w.COLOR_ATTACHMENT0,w.TEXTURE_2D,Ct.__webglTexture,F),it?w.framebufferTextureLayer(w.DRAW_FRAMEBUFFER,w.COLOR_ATTACHMENT0,Wn.__webglTexture,oe,pt+Tt):w.framebufferTexture2D(w.DRAW_FRAMEBUFFER,w.COLOR_ATTACHMENT0,w.TEXTURE_2D,Wn.__webglTexture,oe),F!==0?w.blitFramebuffer(Ee,Oe,he,le,be,et,he,le,w.COLOR_BUFFER_BIT,w.NEAREST):it?w.copyTexSubImage3D(ve,oe,be,et,pt+Tt,Ee,Oe,he,le):w.copyTexSubImage2D(ve,oe,be,et,Ee,Oe,he,le);Se.bindFramebuffer(w.READ_FRAMEBUFFER,null),Se.bindFramebuffer(w.DRAW_FRAMEBUFFER,null)}else it?S.isDataTexture||S.isData3DTexture?w.texSubImage3D(ve,oe,be,et,pt,he,le,xe,tt,It,ht.data):O.isCompressedArrayTexture?w.compressedTexSubImage3D(ve,oe,be,et,pt,he,le,xe,tt,ht.data):w.texSubImage3D(ve,oe,be,et,pt,he,le,xe,tt,It,ht):S.isDataTexture?w.texSubImage2D(w.TEXTURE_2D,oe,be,et,he,le,tt,It,ht.data):S.isCompressedTexture?w.compressedTexSubImage2D(w.TEXTURE_2D,oe,be,et,ht.width,ht.height,tt,ht.data):w.texSubImage2D(w.TEXTURE_2D,oe,be,et,he,le,tt,It,ht);w.pixelStorei(w.UNPACK_ROW_LENGTH,Ht),w.pixelStorei(w.UNPACK_IMAGE_HEIGHT,qe),w.pixelStorei(w.UNPACK_SKIP_PIXELS,Jt),w.pixelStorei(w.UNPACK_SKIP_ROWS,cn),w.pixelStorei(w.UNPACK_SKIP_IMAGES,ni),oe===0&&O.generateMipmaps&&w.generateMipmap(ve),Se.unbindTexture()},this.initRenderTarget=function(S){M.get(S).__webglFramebuffer===void 0&&N.setupRenderTarget(S)},this.initTexture=function(S){S.isCubeTexture?N.setTextureCube(S,0):S.isData3DTexture?N.setTexture3D(S,0):S.isDataArrayTexture||S.isCompressedArrayTexture?N.setTexture2DArray(S,0):N.setTexture2D(S,0),Se.unbindTexture()},this.resetState=function(){C=0,D=0,U=null,Se.reset(),te.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return mn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=Xe._getDrawingBufferColorSpace(e),t.unpackColorSpace=Xe._getUnpackColorSpace()}}function Uc(r,e){if(e===Id)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),r;if(e===vo||e===xu){let t=r.getIndex();if(t===null){const a=[],o=r.getAttribute("position");if(o!==void 0){for(let l=0;l<o.count;l++)a.push(l);r.setIndex(a),t=r.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),r}const n=t.count-2,i=[];if(e===vo)for(let a=1;a<=n;a++)i.push(t.getX(0)),i.push(t.getX(a)),i.push(t.getX(a+1));else for(let a=0;a<n;a++)a%2===0?(i.push(t.getX(a)),i.push(t.getX(a+1)),i.push(t.getX(a+2))):(i.push(t.getX(a+2)),i.push(t.getX(a+1)),i.push(t.getX(a)));i.length/3!==n&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");const s=r.clone();return s.setIndex(i),s.clearGroups(),s}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",e),r}function xg(r){const e=new Map,t=new Map,n=r.clone();return Wu(r,n,function(i,s){e.set(s,i),t.set(i,s)}),n.traverse(function(i){if(!i.isSkinnedMesh)return;const s=i,a=e.get(i),o=a.skeleton.bones;s.skeleton=a.skeleton.clone(),s.bindMatrix.copy(a.bindMatrix),s.skeleton.bones=o.map(function(l){return t.get(l)}),s.bind(s.skeleton,s.bindMatrix)}),n}function Wu(r,e,t){t(r,e);for(let n=0;n<r.children.length;n++)Wu(r.children[n],e.children[n],t)}class DM extends gi{constructor(e){super(e),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(t){return new bg(t)}),this.register(function(t){return new Ag(t)}),this.register(function(t){return new Og(t)}),this.register(function(t){return new Dg(t)}),this.register(function(t){return new Ug(t)}),this.register(function(t){return new Rg(t)}),this.register(function(t){return new Cg(t)}),this.register(function(t){return new Lg(t)}),this.register(function(t){return new wg(t)}),this.register(function(t){return new yg(t)}),this.register(function(t){return new Pg(t)}),this.register(function(t){return new Tg(t)}),this.register(function(t){return new Ng(t)}),this.register(function(t){return new Ig(t)}),this.register(function(t){return new vg(t)}),this.register(function(t){return new Fc(t,Ve.EXT_MESHOPT_COMPRESSION)}),this.register(function(t){return new Fc(t,Ve.KHR_MESHOPT_COMPRESSION)}),this.register(function(t){return new Fg(t)})}load(e,t,n,i){const s=this;let a;if(this.resourcePath!=="")a=this.resourcePath;else if(this.path!==""){const c=Er.extractUrlBase(e);a=Er.resolveURL(c,this.path)}else a=Er.extractUrlBase(e);this.manager.itemStart(e);const o=function(c){i?i(c):console.error(c),s.manager.itemError(e),s.manager.itemEnd(e)},l=new Rs(this.manager);l.setPath(this.path),l.setResponseType("arraybuffer"),l.setRequestHeader(this.requestHeader),l.setWithCredentials(this.withCredentials),l.load(e,function(c){try{s.parse(c,a,function(u){t(u),s.manager.itemEnd(e)},o)}catch(u){o(u)}},n,o)}setDRACOLoader(e){return this.dracoLoader=e,this}setKTX2Loader(e){return this.ktx2Loader=e,this}setMeshoptDecoder(e){return this.meshoptDecoder=e,this}register(e){return this.pluginCallbacks.indexOf(e)===-1&&this.pluginCallbacks.push(e),this}unregister(e){return this.pluginCallbacks.indexOf(e)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e),1),this}parse(e,t,n,i){let s;const a={},o={},l=new TextDecoder;if(typeof e=="string")s=JSON.parse(e);else if(e instanceof ArrayBuffer)if(l.decode(new Uint8Array(e,0,4))===Xu){try{a[Ve.KHR_BINARY_GLTF]=new Bg(e)}catch(h){i&&i(h);return}s=JSON.parse(a[Ve.KHR_BINARY_GLTF].content)}else s=JSON.parse(l.decode(e));else s=e;if(s.asset===void 0||s.asset.version[0]<2){i&&i(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}const c=new Zg(s,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});c.fileLoader.setRequestHeader(this.requestHeader);for(let u=0;u<this.pluginCallbacks.length;u++){const h=this.pluginCallbacks[u](c);h.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),o[h.name]=h,a[h.name]=!0}if(s.extensionsUsed)for(let u=0;u<s.extensionsUsed.length;++u){const h=s.extensionsUsed[u],d=s.extensionsRequired||[];switch(h){case Ve.KHR_MATERIALS_UNLIT:a[h]=new Eg;break;case Ve.KHR_DRACO_MESH_COMPRESSION:a[h]=new kg(s,this.dracoLoader);break;case Ve.KHR_TEXTURE_TRANSFORM:a[h]=new zg;break;case Ve.KHR_MESH_QUANTIZATION:a[h]=new Hg;break;default:d.indexOf(h)>=0&&o[h]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+h+'".')}}c.setExtensions(a),c.setPlugins(o),c.parse(n,i)}parseAsync(e,t){const n=this;return new Promise(function(i,s){n.parse(e,t,i,s)})}}function Sg(){let r={};return{get:function(e){return r[e]},add:function(e,t){r[e]=t},remove:function(e){delete r[e]},removeAll:function(){r={}}}}function _t(r,e,t){const n=r.json.materials[e];return n.extensions&&n.extensions[t]?n.extensions[t]:null}const Ve={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",KHR_MESHOPT_COMPRESSION:"KHR_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"};class vg{constructor(e){this.parser=e,this.name=Ve.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){const e=this.parser,t=this.parser.json.nodes||[];for(let n=0,i=t.length;n<i;n++){const s=t[n];s.extensions&&s.extensions[this.name]&&s.extensions[this.name].light!==void 0&&e._addNodeRef(this.cache,s.extensions[this.name].light)}}_loadLight(e){const t=this.parser,n="light:"+e;let i=t.cache.get(n);if(i)return i;const s=t.json,l=((s.extensions&&s.extensions[this.name]||{}).lights||[])[e];let c;const u=new Le(16777215);l.color!==void 0&&u.setRGB(l.color[0],l.color[1],l.color[2],Dt);const h=l.range!==void 0?l.range:0;switch(l.type){case"directional":c=new ff(u),c.target.position.set(0,0,-1),c.add(c.target);break;case"point":c=new df(u),c.distance=h;break;case"spot":c=new cf(u),c.distance=h,l.spot=l.spot||{},l.spot.innerConeAngle=l.spot.innerConeAngle!==void 0?l.spot.innerConeAngle:0,l.spot.outerConeAngle=l.spot.outerConeAngle!==void 0?l.spot.outerConeAngle:Math.PI/4,c.angle=l.spot.outerConeAngle,c.penumbra=1-l.spot.innerConeAngle/l.spot.outerConeAngle,c.target.position.set(0,0,-1),c.add(c.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+l.type)}return c.position.set(0,0,0),hn(c,l),l.intensity!==void 0&&(c.intensity=l.intensity),c.name=t.createUniqueName(l.name||"light_"+e),i=Promise.resolve(c),t.cache.add(n,i),i}getDependency(e,t){if(e==="light")return this._loadLight(t)}createNodeAttachment(e){const t=this,n=this.parser,s=n.json.nodes[e],o=(s.extensions&&s.extensions[this.name]||{}).light;return o===void 0?null:this._loadLight(o).then(function(l){return n._getNodeRef(t.cache,o,l)})}}class Eg{constructor(){this.name=Ve.KHR_MATERIALS_UNLIT}getMaterialType(){return Dn}extendParams(e,t,n){const i=[];e.color=new Le(1,1,1),e.opacity=1;const s=t.pbrMetallicRoughness;if(s){if(Array.isArray(s.baseColorFactor)){const a=s.baseColorFactor;e.color.setRGB(a[0],a[1],a[2],Dt),e.opacity=a[3]}s.baseColorTexture!==void 0&&i.push(n.assignTexture(e,"map",s.baseColorTexture,dt))}return Promise.all(i)}}class yg{constructor(e){this.parser=e,this.name=Ve.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);return n===null||n.emissiveStrength!==void 0&&(t.emissiveIntensity=n.emissiveStrength),Promise.resolve()}}class bg{constructor(e){this.parser=e,this.name=Ve.KHR_MATERIALS_CLEARCOAT}getMaterialType(e){return _t(this.parser,e,this.name)!==null?En:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];if(n.clearcoatFactor!==void 0&&(t.clearcoat=n.clearcoatFactor),n.clearcoatTexture!==void 0&&i.push(this.parser.assignTexture(t,"clearcoatMap",n.clearcoatTexture)),n.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=n.clearcoatRoughnessFactor),n.clearcoatRoughnessTexture!==void 0&&i.push(this.parser.assignTexture(t,"clearcoatRoughnessMap",n.clearcoatRoughnessTexture)),n.clearcoatNormalTexture!==void 0&&(i.push(this.parser.assignTexture(t,"clearcoatNormalMap",n.clearcoatNormalTexture)),n.clearcoatNormalTexture.scale!==void 0)){const s=n.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new Ie(s,s)}return Promise.all(i)}}class Ag{constructor(e){this.parser=e,this.name=Ve.KHR_MATERIALS_DISPERSION}getMaterialType(e){return _t(this.parser,e,this.name)!==null?En:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);return n===null||(t.dispersion=n.dispersion!==void 0?n.dispersion:0),Promise.resolve()}}class Tg{constructor(e){this.parser=e,this.name=Ve.KHR_MATERIALS_IRIDESCENCE}getMaterialType(e){return _t(this.parser,e,this.name)!==null?En:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];return n.iridescenceFactor!==void 0&&(t.iridescence=n.iridescenceFactor),n.iridescenceTexture!==void 0&&i.push(this.parser.assignTexture(t,"iridescenceMap",n.iridescenceTexture)),n.iridescenceIor!==void 0&&(t.iridescenceIOR=n.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),n.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=n.iridescenceThicknessMinimum),n.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=n.iridescenceThicknessMaximum),n.iridescenceThicknessTexture!==void 0&&i.push(this.parser.assignTexture(t,"iridescenceThicknessMap",n.iridescenceThicknessTexture)),Promise.all(i)}}class Rg{constructor(e){this.parser=e,this.name=Ve.KHR_MATERIALS_SHEEN}getMaterialType(e){return _t(this.parser,e,this.name)!==null?En:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];if(t.sheenColor=new Le(0,0,0),t.sheenRoughness=0,t.sheen=1,n.sheenColorFactor!==void 0){const s=n.sheenColorFactor;t.sheenColor.setRGB(s[0],s[1],s[2],Dt)}return n.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=n.sheenRoughnessFactor),n.sheenColorTexture!==void 0&&i.push(this.parser.assignTexture(t,"sheenColorMap",n.sheenColorTexture,dt)),n.sheenRoughnessTexture!==void 0&&i.push(this.parser.assignTexture(t,"sheenRoughnessMap",n.sheenRoughnessTexture)),Promise.all(i)}}class Cg{constructor(e){this.parser=e,this.name=Ve.KHR_MATERIALS_TRANSMISSION}getMaterialType(e){return _t(this.parser,e,this.name)!==null?En:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];return n.transmissionFactor!==void 0&&(t.transmission=n.transmissionFactor),n.transmissionTexture!==void 0&&i.push(this.parser.assignTexture(t,"transmissionMap",n.transmissionTexture)),Promise.all(i)}}class Lg{constructor(e){this.parser=e,this.name=Ve.KHR_MATERIALS_VOLUME}getMaterialType(e){return _t(this.parser,e,this.name)!==null?En:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];t.thickness=n.thicknessFactor!==void 0?n.thicknessFactor:0,n.thicknessTexture!==void 0&&i.push(this.parser.assignTexture(t,"thicknessMap",n.thicknessTexture)),t.attenuationDistance=n.attenuationDistance||1/0;const s=n.attenuationColor||[1,1,1];return t.attenuationColor=new Le().setRGB(s[0],s[1],s[2],Dt),Promise.all(i)}}class wg{constructor(e){this.parser=e,this.name=Ve.KHR_MATERIALS_IOR}getMaterialType(e){return _t(this.parser,e,this.name)!==null?En:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);return n===null||(t.ior=n.ior!==void 0?n.ior:1.5),Promise.resolve()}}class Pg{constructor(e){this.parser=e,this.name=Ve.KHR_MATERIALS_SPECULAR}getMaterialType(e){return _t(this.parser,e,this.name)!==null?En:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];t.specularIntensity=n.specularFactor!==void 0?n.specularFactor:1,n.specularTexture!==void 0&&i.push(this.parser.assignTexture(t,"specularIntensityMap",n.specularTexture));const s=n.specularColorFactor||[1,1,1];return t.specularColor=new Le().setRGB(s[0],s[1],s[2],Dt),n.specularColorTexture!==void 0&&i.push(this.parser.assignTexture(t,"specularColorMap",n.specularColorTexture,dt)),Promise.all(i)}}class Ig{constructor(e){this.parser=e,this.name=Ve.EXT_MATERIALS_BUMP}getMaterialType(e){return _t(this.parser,e,this.name)!==null?En:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];return t.bumpScale=n.bumpFactor!==void 0?n.bumpFactor:1,n.bumpTexture!==void 0&&i.push(this.parser.assignTexture(t,"bumpMap",n.bumpTexture)),Promise.all(i)}}class Ng{constructor(e){this.parser=e,this.name=Ve.KHR_MATERIALS_ANISOTROPY}getMaterialType(e){return _t(this.parser,e,this.name)!==null?En:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];return n.anisotropyStrength!==void 0&&(t.anisotropy=n.anisotropyStrength),n.anisotropyRotation!==void 0&&(t.anisotropyRotation=n.anisotropyRotation),n.anisotropyTexture!==void 0&&i.push(this.parser.assignTexture(t,"anisotropyMap",n.anisotropyTexture)),Promise.all(i)}}class Og{constructor(e){this.parser=e,this.name=Ve.KHR_TEXTURE_BASISU}loadTexture(e){const t=this.parser,n=t.json,i=n.textures[e];if(!i.extensions||!i.extensions[this.name])return null;const s=i.extensions[this.name],a=t.options.ktx2Loader;if(!a){if(n.extensionsRequired&&n.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return t.loadTextureImage(e,s.source,a)}}class Dg{constructor(e){this.parser=e,this.name=Ve.EXT_TEXTURE_WEBP}loadTexture(e){const t=this.name,n=this.parser,i=n.json,s=i.textures[e];if(!s.extensions||!s.extensions[t])return null;const a=s.extensions[t],o=i.images[a.source];let l=n.textureLoader;if(o.uri){const c=n.options.manager.getHandler(o.uri);c!==null&&(l=c)}return n.loadTextureImage(e,a.source,l)}}class Ug{constructor(e){this.parser=e,this.name=Ve.EXT_TEXTURE_AVIF}loadTexture(e){const t=this.name,n=this.parser,i=n.json,s=i.textures[e];if(!s.extensions||!s.extensions[t])return null;const a=s.extensions[t],o=i.images[a.source];let l=n.textureLoader;if(o.uri){const c=n.options.manager.getHandler(o.uri);c!==null&&(l=c)}return n.loadTextureImage(e,a.source,l)}}class Fc{constructor(e,t){this.name=t,this.parser=e}loadBufferView(e){const t=this.parser.json,n=t.bufferViews[e];if(n.extensions&&n.extensions[this.name]){const i=n.extensions[this.name],s=this.parser.getDependency("buffer",i.buffer),a=this.parser.options.meshoptDecoder;if(!a||!a.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return s.then(function(o){const l=i.byteOffset||0,c=i.byteLength||0,u=i.count,h=i.byteStride,d=new Uint8Array(o,l,c);return a.decodeGltfBufferAsync?a.decodeGltfBufferAsync(u,h,d,i.mode,i.filter).then(function(f){return f.buffer}):a.ready.then(function(){const f=new ArrayBuffer(u*h);return a.decodeGltfBuffer(new Uint8Array(f),u,h,d,i.mode,i.filter),f})})}else return null}}class Fg{constructor(e){this.name=Ve.EXT_MESH_GPU_INSTANCING,this.parser=e}createNodeMesh(e){const t=this.parser.json,n=t.nodes[e];if(!n.extensions||!n.extensions[this.name]||n.mesh===void 0)return null;const i=t.meshes[n.mesh];for(const c of i.primitives)if(c.mode!==qt.TRIANGLES&&c.mode!==qt.TRIANGLE_STRIP&&c.mode!==qt.TRIANGLE_FAN&&c.mode!==void 0)return null;const a=n.extensions[this.name].attributes,o=[],l={};for(const c in a)o.push(this.parser.getDependency("accessor",a[c]).then(u=>(l[c]=u,l[c])));return o.length<1?null:(o.push(this.parser.createNodeMesh(e)),Promise.all(o).then(c=>{const u=c.pop(),h=u.isGroup?u.children:[u],d=c[0].count,f=[];for(const _ of h){const g=new Ne,m=new I,p=new vn,v=new I(1,1,1),y=new Ih(_.geometry,_.material,d);for(let E=0;E<d;E++)l.TRANSLATION&&m.fromBufferAttribute(l.TRANSLATION,E),l.ROTATION&&p.fromBufferAttribute(l.ROTATION,E),l.SCALE&&v.fromBufferAttribute(l.SCALE,E),y.setMatrixAt(E,g.compose(m,p,v));for(const E in l)if(E==="_COLOR_0"){const R=l[E];y.instanceColor=new yo(R.array,R.itemSize,R.normalized)}else E!=="TRANSLATION"&&E!=="ROTATION"&&E!=="SCALE"&&_.geometry.setAttribute(E,l[E]);ut.prototype.copy.call(y,_),this.parser.assignFinalMaterial(y),f.push(y)}return u.isGroup?(u.clear(),u.add(...f),u):f[0]}))}}const Xu="glTF",mr=12,Bc={JSON:1313821514,BIN:5130562};class Bg{constructor(e){this.name=Ve.KHR_BINARY_GLTF,this.content=null,this.body=null;const t=new DataView(e,0,mr),n=new TextDecoder;if(this.header={magic:n.decode(new Uint8Array(e.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==Xu)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");const i=this.header.length-mr,s=new DataView(e,mr);let a=0;for(;a<i;){const o=s.getUint32(a,!0);a+=4;const l=s.getUint32(a,!0);if(a+=4,l===Bc.JSON){const c=new Uint8Array(e,mr+a,o);this.content=n.decode(c)}else if(l===Bc.BIN){const c=mr+a;this.body=e.slice(c,c+o)}a+=o}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}}class kg{constructor(e,t){if(!t)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=Ve.KHR_DRACO_MESH_COMPRESSION,this.json=e,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(e,t){const n=this.json,i=this.dracoLoader,s=e.extensions[this.name].bufferView,a=e.extensions[this.name].attributes,o={},l={},c={};for(const u in a){const h=Co[u]||u.toLowerCase();o[h]=a[u]}for(const u in e.attributes){const h=Co[u]||u.toLowerCase();if(a[u]!==void 0){const d=n.accessors[e.attributes[u]],f=Gi[d.componentType];c[h]=f.name,l[h]=d.normalized===!0}}return t.getDependency("bufferView",s).then(function(u){return new Promise(function(h,d){i.decodeDracoFile(u,function(f){for(const _ in f.attributes){const g=f.attributes[_],m=l[_];m!==void 0&&(g.normalized=m)}h(f)},o,c,Dt,d)})})}}class zg{constructor(){this.name=Ve.KHR_TEXTURE_TRANSFORM}extendTexture(e,t){return(t.texCoord===void 0||t.texCoord===e.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0||(e=e.clone(),t.texCoord!==void 0&&(e.channel=t.texCoord),t.offset!==void 0&&e.offset.fromArray(t.offset),t.rotation!==void 0&&(e.rotation=t.rotation),t.scale!==void 0&&e.repeat.fromArray(t.scale),e.needsUpdate=!0),e}}class Hg{constructor(){this.name=Ve.KHR_MESH_QUANTIZATION}}class Ku extends $i{constructor(e,t,n,i){super(e,t,n,i)}copySampleValue_(e){const t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,s=e*i*3+i;for(let a=0;a!==i;a++)t[a]=n[s+a];return t}interpolate_(e,t,n,i){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=o*2,c=o*3,u=i-t,h=(n-t)/u,d=h*h,f=d*h,_=e*c,g=_-c,m=-2*f+3*d,p=f-d,v=1-m,y=p-d+h;for(let E=0;E!==o;E++){const R=a[g+E+o],T=a[g+E+l]*u,L=a[_+E+o],x=a[_+E]*u;s[E]=v*R+y*T+m*L+p*x}return s}}const Gg=new vn;class Vg extends Ku{interpolate_(e,t,n,i){const s=super.interpolate_(e,t,n,i);return Gg.fromArray(s).normalize().toArray(s),s}}const qt={POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6},Gi={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},kc={9728:St,9729:vt,9984:hu,9985:ms,9986:Mr,9987:On},zc={33071:pn,33648:vs,10497:Xi},Aa={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},Co={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},Jn={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},Wg={CUBICSPLINE:void 0,LINEAR:Rr,STEP:Tr},Ta={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function Xg(r){return r.DefaultMaterial===void 0&&(r.DefaultMaterial=new Ps({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:zn})),r.DefaultMaterial}function ci(r,e,t){for(const n in t.extensions)r[n]===void 0&&(e.userData.gltfExtensions=e.userData.gltfExtensions||{},e.userData.gltfExtensions[n]=t.extensions[n])}function hn(r,e){e.extras!==void 0&&(typeof e.extras=="object"?Object.assign(r.userData,e.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+e.extras))}function Kg(r,e,t){let n=!1,i=!1,s=!1;for(let c=0,u=e.length;c<u;c++){const h=e[c];if(h.POSITION!==void 0&&(n=!0),h.NORMAL!==void 0&&(i=!0),h.COLOR_0!==void 0&&(s=!0),n&&i&&s)break}if(!n&&!i&&!s)return Promise.resolve(r);const a=[],o=[],l=[];for(let c=0,u=e.length;c<u;c++){const h=e[c];if(n){const d=h.POSITION!==void 0?t.getDependency("accessor",h.POSITION):r.attributes.position;a.push(d)}if(i){const d=h.NORMAL!==void 0?t.getDependency("accessor",h.NORMAL):r.attributes.normal;o.push(d)}if(s){const d=h.COLOR_0!==void 0?t.getDependency("accessor",h.COLOR_0):r.attributes.color;l.push(d)}}return Promise.all([Promise.all(a),Promise.all(o),Promise.all(l)]).then(function(c){const u=c[0],h=c[1],d=c[2];return n&&(r.morphAttributes.position=u),i&&(r.morphAttributes.normal=h),s&&(r.morphAttributes.color=d),r.morphTargetsRelative=!0,r})}function qg(r,e){if(r.updateMorphTargets(),e.weights!==void 0)for(let t=0,n=e.weights.length;t<n;t++)r.morphTargetInfluences[t]=e.weights[t];if(e.extras&&Array.isArray(e.extras.targetNames)){const t=e.extras.targetNames;if(r.morphTargetInfluences.length===t.length){r.morphTargetDictionary={};for(let n=0,i=t.length;n<i;n++)r.morphTargetDictionary[t[n]]=n}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function jg(r){let e;const t=r.extensions&&r.extensions[Ve.KHR_DRACO_MESH_COMPRESSION];if(t?e="draco:"+t.bufferView+":"+t.indices+":"+Ra(t.attributes):e=r.indices+":"+Ra(r.attributes)+":"+r.mode,r.targets!==void 0)for(let n=0,i=r.targets.length;n<i;n++)e+=":"+Ra(r.targets[n]);return e}function Ra(r){let e="";const t=Object.keys(r).sort();for(let n=0,i=t.length;n<i;n++)e+=t[n]+":"+r[t[n]]+";";return e}function Lo(r){switch(r){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function Qg(r){return r.search(/\.jpe?g($|\?)/i)>0||r.search(/^data\:image\/jpeg/)===0?"image/jpeg":r.search(/\.webp($|\?)/i)>0||r.search(/^data\:image\/webp/)===0?"image/webp":r.search(/\.ktx2($|\?)/i)>0||r.search(/^data\:image\/ktx2/)===0?"image/ktx2":"image/png"}const Yg=new Ne;class Zg{constructor(e={},t={}){this.json=e,this.extensions={},this.plugins={},this.options=t,this.cache=new Sg,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let n=!1,i=-1,s=!1,a=-1;if(typeof navigator<"u"&&typeof navigator.userAgent<"u"){const o=navigator.userAgent;n=/^((?!chrome|android).)*safari/i.test(o)===!0;const l=o.match(/Version\/(\d+)/);i=n&&l?parseInt(l[1],10):-1,s=o.indexOf("Firefox")>-1,a=s?o.match(/Firefox\/([0-9]+)\./)[1]:-1}typeof createImageBitmap>"u"||n&&i<17||s&&a<98?this.textureLoader=new Uu(this.options.manager):this.textureLoader=new pf(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new Rs(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}setExtensions(e){this.extensions=e}setPlugins(e){this.plugins=e}parse(e,t){const n=this,i=this.json,s=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(a){return a._markDefs&&a._markDefs()}),Promise.all(this._invokeAll(function(a){return a.beforeRoot&&a.beforeRoot()})).then(function(){return Promise.all([n.getDependencies("scene"),n.getDependencies("animation"),n.getDependencies("camera")])}).then(function(a){const o={scene:a[0][i.scene||0],scenes:a[0],animations:a[1],cameras:a[2],asset:i.asset,parser:n,userData:{}};return ci(s,o,i),hn(o,i),Promise.all(n._invokeAll(function(l){return l.afterRoot&&l.afterRoot(o)})).then(function(){for(const l of o.scenes)l.updateMatrixWorld();e(o)})}).catch(t)}_markDefs(){const e=this.json.nodes||[],t=this.json.skins||[],n=this.json.meshes||[];for(let i=0,s=t.length;i<s;i++){const a=t[i].joints;for(let o=0,l=a.length;o<l;o++)e[a[o]].isBone=!0}for(let i=0,s=e.length;i<s;i++){const a=e[i];a.mesh!==void 0&&(this._addNodeRef(this.meshCache,a.mesh),a.skin!==void 0&&(n[a.mesh].isSkinnedMesh=!0)),a.camera!==void 0&&this._addNodeRef(this.cameraCache,a.camera)}}_addNodeRef(e,t){t!==void 0&&(e.refs[t]===void 0&&(e.refs[t]=e.uses[t]=0),e.refs[t]++)}_getNodeRef(e,t,n){if(e.refs[t]<=1)return n;const i=n.clone(),s=(a,o)=>{const l=this.associations.get(a);l!=null&&this.associations.set(o,l);for(const[c,u]of a.children.entries())s(u,o.children[c])};return s(n,i),i.name+="_instance_"+e.uses[t]++,i}_invokeOne(e){const t=Object.values(this.plugins);t.push(this);for(let n=0;n<t.length;n++){const i=e(t[n]);if(i)return i}return null}_invokeAll(e){const t=Object.values(this.plugins);t.unshift(this);const n=[];for(let i=0;i<t.length;i++){const s=e(t[i]);s&&n.push(s)}return n}getDependency(e,t){const n=e+":"+t;let i=this.cache.get(n);if(!i){switch(e){case"scene":i=this.loadScene(t);break;case"node":i=this._invokeOne(function(s){return s.loadNode&&s.loadNode(t)});break;case"mesh":i=this._invokeOne(function(s){return s.loadMesh&&s.loadMesh(t)});break;case"accessor":i=this.loadAccessor(t);break;case"bufferView":i=this._invokeOne(function(s){return s.loadBufferView&&s.loadBufferView(t)});break;case"buffer":i=this.loadBuffer(t);break;case"material":i=this._invokeOne(function(s){return s.loadMaterial&&s.loadMaterial(t)});break;case"texture":i=this._invokeOne(function(s){return s.loadTexture&&s.loadTexture(t)});break;case"skin":i=this.loadSkin(t);break;case"animation":i=this._invokeOne(function(s){return s.loadAnimation&&s.loadAnimation(t)});break;case"camera":i=this.loadCamera(t);break;default:if(i=this._invokeOne(function(s){return s!=this&&s.getDependency&&s.getDependency(e,t)}),!i)throw new Error("Unknown type: "+e);break}this.cache.add(n,i)}return i}getDependencies(e){let t=this.cache.get(e);if(!t){const n=this,i=this.json[e+(e==="mesh"?"es":"s")]||[];t=Promise.all(i.map(function(s,a){return n.getDependency(e,a)})),this.cache.add(e,t)}return t}loadBuffer(e){const t=this.json.buffers[e],n=this.fileLoader;if(t.type&&t.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(t.uri===void 0&&e===0)return Promise.resolve(this.extensions[Ve.KHR_BINARY_GLTF].body);const i=this.options;return new Promise(function(s,a){n.load(Er.resolveURL(t.uri,i.path),s,void 0,function(){a(new Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}loadBufferView(e){const t=this.json.bufferViews[e];return this.getDependency("buffer",t.buffer).then(function(n){const i=t.byteLength||0,s=t.byteOffset||0;return n.slice(s,s+i)})}loadAccessor(e){const t=this,n=this.json,i=this.json.accessors[e];if(i.bufferView===void 0&&i.sparse===void 0){const a=Aa[i.type],o=Gi[i.componentType],l=i.normalized===!0,c=new o(i.count*a);return Promise.resolve(new Lt(c,a,l))}const s=[];return i.bufferView!==void 0?s.push(this.getDependency("bufferView",i.bufferView)):s.push(null),i.sparse!==void 0&&(s.push(this.getDependency("bufferView",i.sparse.indices.bufferView)),s.push(this.getDependency("bufferView",i.sparse.values.bufferView))),Promise.all(s).then(function(a){const o=a[0],l=Aa[i.type],c=Gi[i.componentType],u=c.BYTES_PER_ELEMENT,h=u*l,d=i.byteOffset||0,f=i.bufferView!==void 0?n.bufferViews[i.bufferView].byteStride:void 0,_=i.normalized===!0;let g,m;if(f&&f!==h){const p=Math.floor(d/f),v="InterleavedBuffer:"+i.bufferView+":"+i.componentType+":"+p+":"+i.count;let y=t.cache.get(v);y||(g=new c(o,p*f,i.count*f/u),y=new Qo(g,f/u),t.cache.add(v,y)),m=new ji(y,l,d%f/u,_)}else o===null?g=new c(i.count*l):g=new c(o,d,i.count*l),m=new Lt(g,l,_);if(i.sparse!==void 0){const p=Aa.SCALAR,v=Gi[i.sparse.indices.componentType],y=i.sparse.indices.byteOffset||0,E=i.sparse.values.byteOffset||0,R=new v(a[1],y,i.sparse.count*p),T=new c(a[2],E,i.sparse.count*l);o!==null&&(m=new Lt(m.array.slice(),m.itemSize,m.normalized)),m.normalized=!1;for(let L=0,x=R.length;L<x;L++){const b=R[L];if(m.setX(b,T[L*l]),l>=2&&m.setY(b,T[L*l+1]),l>=3&&m.setZ(b,T[L*l+2]),l>=4&&m.setW(b,T[L*l+3]),l>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}m.normalized=_}return m})}loadTexture(e){const t=this.json,n=this.options,s=t.textures[e].source,a=t.images[s];let o=this.textureLoader;if(a.uri){const l=n.manager.getHandler(a.uri);l!==null&&(o=l)}return this.loadTextureImage(e,s,o)}loadTextureImage(e,t,n){const i=this,s=this.json,a=s.textures[e],o=s.images[t],l=(o.uri||o.bufferView)+":"+a.sampler;if(this.textureCache[l])return this.textureCache[l];const c=this.loadImageSource(t,n).then(function(u){u.flipY=!1,u.name=a.name||o.name||"",u.name===""&&typeof o.uri=="string"&&o.uri.startsWith("data:image/")===!1&&(u.name=o.uri);const d=(s.samplers||{})[a.sampler]||{};return u.magFilter=kc[d.magFilter]||vt,u.minFilter=kc[d.minFilter]||On,u.wrapS=zc[d.wrapS]||Xi,u.wrapT=zc[d.wrapT]||Xi,u.generateMipmaps=!u.isCompressedTexture&&u.minFilter!==St&&u.minFilter!==vt,i.associations.set(u,{textures:e}),u}).catch(function(){return null});return this.textureCache[l]=c,c}loadImageSource(e,t){const n=this,i=this.json,s=this.options;if(this.sourceCache[e]!==void 0)return this.sourceCache[e].then(h=>h.clone());const a=i.images[e],o=self.URL||self.webkitURL;let l=a.uri||"",c=!1;if(a.bufferView!==void 0)l=n.getDependency("bufferView",a.bufferView).then(function(h){c=!0;const d=new Blob([h],{type:a.mimeType});return l=o.createObjectURL(d),l});else if(a.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+e+" is missing URI and bufferView");const u=Promise.resolve(l).then(function(h){return new Promise(function(d,f){let _=d;t.isImageBitmapLoader===!0&&(_=function(g){const m=new Et(g);m.needsUpdate=!0,d(m)}),t.load(Er.resolveURL(h,s.path),_,void 0,f)})}).then(function(h){return c===!0&&o.revokeObjectURL(l),hn(h,a),h.userData.mimeType=a.mimeType||Qg(a.uri),h}).catch(function(h){throw console.error("THREE.GLTFLoader: Couldn't load texture",l),h});return this.sourceCache[e]=u,u}assignTexture(e,t,n,i){const s=this;return this.getDependency("texture",n.index).then(function(a){if(!a)return null;if(n.texCoord!==void 0&&n.texCoord>0&&(a=a.clone(),a.channel=n.texCoord),s.extensions[Ve.KHR_TEXTURE_TRANSFORM]){const o=n.extensions!==void 0?n.extensions[Ve.KHR_TEXTURE_TRANSFORM]:void 0;if(o){const l=s.associations.get(a);a=s.extensions[Ve.KHR_TEXTURE_TRANSFORM].extendTexture(a,o),s.associations.set(a,l)}}return i!==void 0&&(a.colorSpace=i),e[t]=a,a})}assignFinalMaterial(e){const t=e.geometry;let n=e.material;const i=t.attributes.tangent===void 0,s=t.attributes.color!==void 0,a=t.attributes.normal===void 0;if(e.isPoints){const o="PointsMaterial:"+n.uuid;let l=this.cache.get(o);l||(l=new Cu,Zt.prototype.copy.call(l,n),l.color.copy(n.color),l.map=n.map,l.sizeAttenuation=!1,this.cache.add(o,l)),n=l}else if(e.isLine){const o="LineBasicMaterial:"+n.uuid;let l=this.cache.get(o);l||(l=new Ru,Zt.prototype.copy.call(l,n),l.color.copy(n.color),l.map=n.map,this.cache.add(o,l)),n=l}if(i||s||a){let o="ClonedMaterial:"+n.uuid+":";i&&(o+="derivative-tangents:"),s&&(o+="vertex-colors:"),a&&(o+="flat-shading:");let l=this.cache.get(o);l||(l=n.clone(),s&&(l.vertexColors=!0),a&&(l.flatShading=!0),i&&(l.normalScale&&(l.normalScale.y*=-1),l.clearcoatNormalScale&&(l.clearcoatNormalScale.y*=-1)),this.cache.add(o,l),this.associations.set(l,this.associations.get(n))),n=l}e.material=n}getMaterialType(){return Ps}loadMaterial(e){const t=this,n=this.json,i=this.extensions,s=n.materials[e];let a;const o={},l=s.extensions||{},c=[];if(l[Ve.KHR_MATERIALS_UNLIT]){const h=i[Ve.KHR_MATERIALS_UNLIT];a=h.getMaterialType(),c.push(h.extendParams(o,s,t))}else{const h=s.pbrMetallicRoughness||{};if(o.color=new Le(1,1,1),o.opacity=1,Array.isArray(h.baseColorFactor)){const d=h.baseColorFactor;o.color.setRGB(d[0],d[1],d[2],Dt),o.opacity=d[3]}h.baseColorTexture!==void 0&&c.push(t.assignTexture(o,"map",h.baseColorTexture,dt)),o.metalness=h.metallicFactor!==void 0?h.metallicFactor:1,o.roughness=h.roughnessFactor!==void 0?h.roughnessFactor:1,h.metallicRoughnessTexture!==void 0&&(c.push(t.assignTexture(o,"metalnessMap",h.metallicRoughnessTexture)),c.push(t.assignTexture(o,"roughnessMap",h.metallicRoughnessTexture))),a=this._invokeOne(function(d){return d.getMaterialType&&d.getMaterialType(e)}),c.push(Promise.all(this._invokeAll(function(d){return d.extendMaterialParams&&d.extendMaterialParams(e,o)})))}s.doubleSided===!0&&(o.side=nn);const u=s.alphaMode||Ta.OPAQUE;if(u===Ta.BLEND?(o.transparent=!0,o.depthWrite=!1):(o.transparent=!1,u===Ta.MASK&&(o.alphaTest=s.alphaCutoff!==void 0?s.alphaCutoff:.5)),s.normalTexture!==void 0&&a!==Dn&&(c.push(t.assignTexture(o,"normalMap",s.normalTexture)),o.normalScale=new Ie(1,1),s.normalTexture.scale!==void 0)){const h=s.normalTexture.scale;o.normalScale.set(h,h)}if(s.occlusionTexture!==void 0&&a!==Dn&&(c.push(t.assignTexture(o,"aoMap",s.occlusionTexture)),s.occlusionTexture.strength!==void 0&&(o.aoMapIntensity=s.occlusionTexture.strength)),s.emissiveFactor!==void 0&&a!==Dn){const h=s.emissiveFactor;o.emissive=new Le().setRGB(h[0],h[1],h[2],Dt)}return s.emissiveTexture!==void 0&&a!==Dn&&c.push(t.assignTexture(o,"emissiveMap",s.emissiveTexture,dt)),Promise.all(c).then(function(){const h=new a(o);return s.name&&(h.name=s.name),hn(h,s),t.associations.set(h,{materials:e}),s.extensions&&ci(i,h,s),h})}createUniqueName(e){const t=$e.sanitizeNodeName(e||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(e){const t=this,n=this.extensions,i=this.primitiveCache;function s(o){return n[Ve.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(o,t).then(function(l){return Hc(l,o,t)})}const a=[];for(let o=0,l=e.length;o<l;o++){const c=e[o],u=jg(c),h=i[u];if(h)a.push(h.promise);else{let d;c.extensions&&c.extensions[Ve.KHR_DRACO_MESH_COMPRESSION]?d=s(c):d=Hc(new Pt,c,t),i[u]={primitive:c,promise:d},a.push(d)}}return Promise.all(a)}loadMesh(e){const t=this,n=this.json,i=this.extensions,s=n.meshes[e],a=s.primitives,o=[];for(let l=0,c=a.length;l<c;l++){const u=a[l].material===void 0?Xg(this.cache):this.getDependency("material",a[l].material);o.push(u)}return o.push(t.loadGeometries(a)),Promise.all(o).then(function(l){const c=l.slice(0,l.length-1),u=l[l.length-1],h=[];for(let f=0,_=u.length;f<_;f++){const g=u[f],m=a[f];let p;const v=c[f];if(m.mode===qt.TRIANGLES||m.mode===qt.TRIANGLE_STRIP||m.mode===qt.TRIANGLE_FAN||m.mode===void 0)p=s.isSkinnedMesh===!0?new Lh(g,v):new wt(g,v),p.isSkinnedMesh===!0&&p.normalizeSkinWeights(),m.mode===qt.TRIANGLE_STRIP?p.geometry=Uc(p.geometry,xu):m.mode===qt.TRIANGLE_FAN&&(p.geometry=Uc(p.geometry,vo));else if(m.mode===qt.LINES)p=new Uh(g,v);else if(m.mode===qt.LINE_STRIP)p=new Jo(g,v);else if(m.mode===qt.LINE_LOOP)p=new Fh(g,v);else if(m.mode===qt.POINTS)p=new Bh(g,v);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+m.mode);Object.keys(p.geometry.morphAttributes).length>0&&qg(p,s),p.name=t.createUniqueName(s.name||"mesh_"+e),hn(p,s),m.extensions&&ci(i,p,m),t.assignFinalMaterial(p),h.push(p)}for(let f=0,_=h.length;f<_;f++)t.associations.set(h[f],{meshes:e,primitives:f});if(h.length===1)return s.extensions&&ci(i,h[0],s),h[0];const d=new _n;s.extensions&&ci(i,d,s),t.associations.set(d,{meshes:e});for(let f=0,_=h.length;f<_;f++)d.add(h[f]);return d})}loadCamera(e){let t;const n=this.json.cameras[e],i=n[n.type];if(!i){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return n.type==="perspective"?t=new kt(lh.radToDeg(i.yfov),i.aspectRatio||1,i.znear||1,i.zfar||2e6):n.type==="orthographic"&&(t=new Ns(-i.xmag,i.xmag,i.ymag,-i.ymag,i.znear,i.zfar)),n.name&&(t.name=this.createUniqueName(n.name)),hn(t,n),Promise.resolve(t)}loadSkin(e){const t=this.json.skins[e],n=[];for(let i=0,s=t.joints.length;i<s;i++)n.push(this._loadNodeShallow(t.joints[i]));return t.inverseBindMatrices!==void 0?n.push(this.getDependency("accessor",t.inverseBindMatrices)):n.push(null),Promise.all(n).then(function(i){const s=i.pop(),a=i,o=[],l=[];for(let c=0,u=a.length;c<u;c++){const h=a[c];if(h){o.push(h);const d=new Ne;s!==null&&d.fromArray(s.array,c*16),l.push(d)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[c])}return new Zo(o,l)})}loadAnimation(e){const t=this.json,n=this,i=t.animations[e],s=i.name?i.name:"animation_"+e,a=[],o=[],l=[],c=[],u=[];for(let h=0,d=i.channels.length;h<d;h++){const f=i.channels[h],_=i.samplers[f.sampler],g=f.target,m=g.node,p=i.parameters!==void 0?i.parameters[_.input]:_.input,v=i.parameters!==void 0?i.parameters[_.output]:_.output;g.node!==void 0&&(a.push(this.getDependency("node",m)),o.push(this.getDependency("accessor",p)),l.push(this.getDependency("accessor",v)),c.push(_),u.push(g))}return Promise.all([Promise.all(a),Promise.all(o),Promise.all(l),Promise.all(c),Promise.all(u)]).then(function(h){const d=h[0],f=h[1],_=h[2],g=h[3],m=h[4],p=[];for(let y=0,E=d.length;y<E;y++){const R=d[y],T=f[y],L=_[y],x=g[y],b=m[y];if(R===void 0)continue;R.updateMatrix&&R.updateMatrix();const V=n._createAnimationTracks(R,T,L,x,b);if(V)for(let C=0;C<V.length;C++)p.push(V[C])}const v=new ef(s,void 0,p);return hn(v,i),v})}createNodeMesh(e){const t=this.json,n=this,i=t.nodes[e];return i.mesh===void 0?null:n.getDependency("mesh",i.mesh).then(function(s){const a=n._getNodeRef(n.meshCache,i.mesh,s);return i.weights!==void 0&&a.traverse(function(o){if(o.isMesh)for(let l=0,c=i.weights.length;l<c;l++)o.morphTargetInfluences[l]=i.weights[l]}),a})}loadNode(e){const t=this.json,n=this,i=t.nodes[e],s=n._loadNodeShallow(e),a=[],o=i.children||[];for(let c=0,u=o.length;c<u;c++)a.push(n.getDependency("node",o[c]));const l=i.skin===void 0?Promise.resolve(null):n.getDependency("skin",i.skin);return Promise.all([s,Promise.all(a),l]).then(function(c){const u=c[0],h=c[1],d=c[2];d!==null&&u.traverse(function(f){f.isSkinnedMesh&&f.bind(d,Yg)});for(let f=0,_=h.length;f<_;f++)u.add(h[f]);if(u.userData.pivot!==void 0&&h.length>0){const f=u.userData.pivot,_=h[0];u.pivot=new I().fromArray(f),u.position.x-=f[0],u.position.y-=f[1],u.position.z-=f[2],_.position.set(0,0,0),delete u.userData.pivot}return u})}_loadNodeShallow(e){const t=this.json,n=this.extensions,i=this;if(this.nodeCache[e]!==void 0)return this.nodeCache[e];const s=t.nodes[e],a=s.name?i.createUniqueName(s.name):"",o=[],l=i._invokeOne(function(c){return c.createNodeMesh&&c.createNodeMesh(e)});return l&&o.push(l),s.camera!==void 0&&o.push(i.getDependency("camera",s.camera).then(function(c){return i._getNodeRef(i.cameraCache,s.camera,c)})),i._invokeAll(function(c){return c.createNodeAttachment&&c.createNodeAttachment(e)}).forEach(function(c){o.push(c)}),this.nodeCache[e]=Promise.all(o).then(function(c){let u;if(s.isBone===!0?u=new Tu:c.length>1?u=new _n:c.length===1?u=c[0]:u=new ut,u!==c[0])for(let h=0,d=c.length;h<d;h++)u.add(c[h]);if(s.name&&(u.userData.name=s.name,u.name=a),hn(u,s),s.extensions&&ci(n,u,s),s.matrix!==void 0){const h=new Ne;h.fromArray(s.matrix),u.applyMatrix4(h)}else s.translation!==void 0&&u.position.fromArray(s.translation),s.rotation!==void 0&&u.quaternion.fromArray(s.rotation),s.scale!==void 0&&u.scale.fromArray(s.scale);if(!i.associations.has(u))i.associations.set(u,{});else if(s.mesh!==void 0&&i.meshCache.refs[s.mesh]>1){const h=i.associations.get(u);i.associations.set(u,{...h})}return i.associations.get(u).nodes=e,u}),this.nodeCache[e]}loadScene(e){const t=this.extensions,n=this.json.scenes[e],i=this,s=new _n;n.name&&(s.name=i.createUniqueName(n.name)),hn(s,n),n.extensions&&ci(t,s,n);const a=n.nodes||[],o=[];for(let l=0,c=a.length;l<c;l++)o.push(i.getDependency("node",a[l]));return Promise.all(o).then(function(l){for(let u=0,h=l.length;u<h;u++){const d=l[u];d.parent!==null?s.add(xg(d)):s.add(d)}const c=u=>{const h=new Map;for(const[d,f]of i.associations)(d instanceof Zt||d instanceof Et)&&h.set(d,f);return u.traverse(d=>{const f=i.associations.get(d);f!=null&&h.set(d,f)}),h};return i.associations=c(s),s})}_createAnimationTracks(e,t,n,i,s){const a=[],o=e.name?e.name:e.uuid,l=[];Jn[s.path]===Jn.weights?e.traverse(function(d){d.morphTargetInfluences&&l.push(d.name?d.name:d.uuid)}):l.push(o);let c;switch(Jn[s.path]){case Jn.weights:c=Yi;break;case Jn.rotation:c=Zi;break;case Jn.translation:case Jn.scale:c=Ji;break;default:n.itemSize===1?c=Yi:c=Ji;break}const u=i.interpolation!==void 0?Wg[i.interpolation]:Rr,h=this._getArrayFromAccessor(n);for(let d=0,f=l.length;d<f;d++){const _=new c(l[d]+"."+Jn[s.path],t.array,h,u);i.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(_),a.push(_)}return a}_getArrayFromAccessor(e){let t=e.array;if(e.normalized){const n=Lo(t.constructor),i=new Float32Array(t.length);for(let s=0,a=t.length;s<a;s++)i[s]=t[s]*n;t=i}return t}_createCubicSplineTrackInterpolant(e){e.createInterpolant=function(n){const i=this instanceof Zi?Vg:Ku;return new i(this.times,this.values,this.getValueSize()/3,n)},e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}}function Jg(r,e,t){const n=e.attributes,i=new Vn;if(n.POSITION!==void 0){const o=t.json.accessors[n.POSITION],l=o.min,c=o.max;if(l!==void 0&&c!==void 0){if(i.set(new I(l[0],l[1],l[2]),new I(c[0],c[1],c[2])),o.normalized){const u=Lo(Gi[o.componentType]);i.min.multiplyScalar(u),i.max.multiplyScalar(u)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;const s=e.targets;if(s!==void 0){const o=new I,l=new I;for(let c=0,u=s.length;c<u;c++){const h=s[c];if(h.POSITION!==void 0){const d=t.json.accessors[h.POSITION],f=d.min,_=d.max;if(f!==void 0&&_!==void 0){if(l.setX(Math.max(Math.abs(f[0]),Math.abs(_[0]))),l.setY(Math.max(Math.abs(f[1]),Math.abs(_[1]))),l.setZ(Math.max(Math.abs(f[2]),Math.abs(_[2]))),d.normalized){const g=Lo(Gi[d.componentType]);l.multiplyScalar(g)}o.max(l)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}i.expandByVector(o)}r.boundingBox=i;const a=new on;i.getCenter(a.center),a.radius=i.min.distanceTo(i.max)/2,r.boundingSphere=a}function Hc(r,e,t){const n=e.attributes,i=[];function s(a,o){return t.getDependency("accessor",a).then(function(l){r.setAttribute(o,l)})}for(const a in n){const o=Co[a]||a.toLowerCase();o in r.attributes||i.push(s(n[a],o))}if(e.indices!==void 0&&!r.index){const a=t.getDependency("accessor",e.indices).then(function(o){r.setIndex(o)});i.push(a)}return Xe.workingColorSpace!==Dt&&"COLOR_0"in n&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${Xe.workingColorSpace}" not supported.`),hn(r,e),Jg(r,e,t),Promise.all(i).then(function(){return e.targets!==void 0?Kg(r,e.targets,t):r})}const Ca=new WeakMap;class UM extends gi{constructor(e){super(e),this.decoderPath="",this.decoderConfig={},this.decoderBinary=null,this.decoderPending=null,this.workerLimit=4,this.workerPool=[],this.workerNextTaskID=1,this.workerSourceURL="",this.defaultAttributeIDs={position:"POSITION",normal:"NORMAL",color:"COLOR",uv:"TEX_COORD"},this.defaultAttributeTypes={position:"Float32Array",normal:"Float32Array",color:"Float32Array",uv:"Float32Array"}}setDecoderPath(e){return this.decoderPath=e,this}setDecoderConfig(e){return this.decoderConfig=e,this}setWorkerLimit(e){return this.workerLimit=e,this}load(e,t,n,i){const s=new Rs(this.manager);s.setPath(this.path),s.setResponseType("arraybuffer"),s.setRequestHeader(this.requestHeader),s.setWithCredentials(this.withCredentials),s.load(e,a=>{this.parse(a,t,i)},n,i)}parse(e,t,n=()=>{}){this.decodeDracoFile(e,t,null,null,dt,n).catch(n)}decodeDracoFile(e,t,n,i,s=Dt,a=()=>{}){const o={attributeIDs:n||this.defaultAttributeIDs,attributeTypes:i||this.defaultAttributeTypes,useUniqueIDs:!!n,vertexColorSpace:s};return this.decodeGeometry(e,o).then(t).catch(a)}decodeGeometry(e,t){const n=JSON.stringify(t);if(Ca.has(e)){const l=Ca.get(e);if(l.key===n)return l.promise;if(e.byteLength===0)throw new Error("THREE.DRACOLoader: Unable to re-decode a buffer with different settings. Buffer has already been transferred.")}let i;const s=this.workerNextTaskID++,a=e.byteLength,o=this._getWorker(s,a).then(l=>(i=l,new Promise((c,u)=>{i._callbacks[s]={resolve:c,reject:u},i.postMessage({type:"decode",id:s,taskConfig:t,buffer:e},[e])}))).then(l=>this._createGeometry(l.geometry));return o.catch(()=>!0).then(()=>{i&&s&&this._releaseTask(i,s)}),Ca.set(e,{key:n,promise:o}),o}_createGeometry(e){const t=new Pt;e.index&&t.setIndex(new Lt(e.index.array,1));for(let n=0;n<e.attributes.length;n++){const{name:i,array:s,itemSize:a,stride:o,vertexColorSpace:l}=e.attributes[n];let c;if(a===o)c=new Lt(s,a);else{const u=new Qo(s,o);c=new ji(u,a,0)}i==="color"&&(this._assignVertexColorSpace(c,l),c.normalized=!(s instanceof Float32Array)),t.setAttribute(i,c)}return t}_assignVertexColorSpace(e,t){if(t!==dt)return;const n=new Le;for(let i=0,s=e.count;i<s;i++)n.fromBufferAttribute(e,i),Xe.colorSpaceToWorking(n,dt),e.setXYZ(i,n.r,n.g,n.b)}_loadLibrary(e,t){const n=new Rs(this.manager);return n.setPath(this.decoderPath),n.setResponseType(t),n.setWithCredentials(this.withCredentials),new Promise((i,s)=>{n.load(e,i,void 0,s)})}preload(){return this._initDecoder(),this}_initDecoder(){if(this.decoderPending)return this.decoderPending;const e=typeof WebAssembly!="object"||this.decoderConfig.type==="js",t=[];return e?t.push(this._loadLibrary("draco_decoder.js","text")):(t.push(this._loadLibrary("draco_wasm_wrapper.js","text")),t.push(this._loadLibrary("draco_decoder.wasm","arraybuffer"))),this.decoderPending=Promise.all(t).then(n=>{const i=n[0];e||(this.decoderConfig.wasmBinary=n[1]);const s=$g.toString(),a=["/* draco decoder */",i,"","/* worker */",s.substring(s.indexOf("{")+1,s.lastIndexOf("}"))].join(`
`);this.workerSourceURL=URL.createObjectURL(new Blob([a]))}),this.decoderPending}_getWorker(e,t){return this._initDecoder().then(()=>{if(this.workerPool.length<this.workerLimit){const i=new Worker(this.workerSourceURL);i._callbacks={},i._taskCosts={},i._taskLoad=0,i.postMessage({type:"init",decoderConfig:this.decoderConfig}),i.onmessage=function(s){const a=s.data;switch(a.type){case"decode":i._callbacks[a.id].resolve(a);break;case"error":i._callbacks[a.id].reject(a);break;default:console.error('THREE.DRACOLoader: Unexpected message, "'+a.type+'"')}},this.workerPool.push(i)}else this.workerPool.sort(function(i,s){return i._taskLoad>s._taskLoad?-1:1});const n=this.workerPool[this.workerPool.length-1];return n._taskCosts[e]=t,n._taskLoad+=t,n})}_releaseTask(e,t){e._taskLoad-=e._taskCosts[t],delete e._callbacks[t],delete e._taskCosts[t]}debug(){console.log("Task load: ",this.workerPool.map(e=>e._taskLoad))}dispose(){for(let e=0;e<this.workerPool.length;++e)this.workerPool[e].terminate();return this.workerPool.length=0,this.workerSourceURL!==""&&URL.revokeObjectURL(this.workerSourceURL),this}}function $g(){let r,e;onmessage=function(a){const o=a.data;switch(o.type){case"init":r=o.decoderConfig,e=new Promise(function(u){r.onModuleLoaded=function(h){u({draco:h})},DracoDecoderModule(r)});break;case"decode":const l=o.buffer,c=o.taskConfig;e.then(u=>{const h=u.draco,d=new h.Decoder;try{const f=t(h,d,new Int8Array(l),c),_=f.attributes.map(g=>g.array.buffer);f.index&&_.push(f.index.array.buffer),self.postMessage({type:"decode",id:o.id,geometry:f},_)}catch(f){console.error(f),self.postMessage({type:"error",id:o.id,error:f.message})}finally{h.destroy(d)}});break}};function t(a,o,l,c){const u=c.attributeIDs,h=c.attributeTypes;let d,f;const _=o.GetEncodedGeometryType(l);if(_===a.TRIANGULAR_MESH)d=new a.Mesh,f=o.DecodeArrayToMesh(l,l.byteLength,d);else if(_===a.POINT_CLOUD)d=new a.PointCloud,f=o.DecodeArrayToPointCloud(l,l.byteLength,d);else throw new Error("THREE.DRACOLoader: Unexpected geometry type.");if(!f.ok()||d.ptr===0)throw new Error("THREE.DRACOLoader: Decoding failed: "+f.error_msg());const g={index:null,attributes:[]};for(const m in u){const p=self[h[m]];let v,y;if(c.useUniqueIDs)y=u[m],v=o.GetAttributeByUniqueId(d,y);else{if(y=o.GetAttributeId(d,a[u[m]]),y===-1)continue;v=o.GetAttribute(d,y)}const E=i(a,o,d,m,p,v);m==="color"&&(E.vertexColorSpace=c.vertexColorSpace),g.attributes.push(E)}return _===a.TRIANGULAR_MESH&&(g.index=n(a,o,d)),a.destroy(d),g}function n(a,o,l){const u=l.num_faces()*3,h=u*4,d=a._malloc(h);o.GetTrianglesUInt32Array(l,h,d);const f=new Uint32Array(a.HEAPF32.buffer,d,u).slice();return a._free(d),{array:f,itemSize:1}}function i(a,o,l,c,u,h){const d=l.num_points(),f=h.num_components(),_=s(a,u),g=f*u.BYTES_PER_ELEMENT,m=Math.ceil(g/4)*4,p=m/u.BYTES_PER_ELEMENT,v=d*g,y=d*m,E=a._malloc(v);o.GetAttributeDataArrayForAllPoints(l,h,_,v,E);const R=new u(a.HEAPF32.buffer,E,v/u.BYTES_PER_ELEMENT);let T;if(g===m)T=R.slice();else{T=new u(y/u.BYTES_PER_ELEMENT);let L=0;for(let x=0,b=R.length;x<b;x++){for(let V=0;V<f;V++)T[L+V]=R[x*f+V];L+=p}}return a._free(E),{name:c,count:d,itemSize:f,array:T,stride:p}}function s(a,o){switch(o){case Float32Array:return a.DT_FLOAT32;case Int8Array:return a.DT_INT8;case Int16Array:return a.DT_INT16;case Int32Array:return a.DT_INT32;case Uint8Array:return a.DT_UINT8;case Uint16Array:return a.DT_UINT16;case Uint32Array:return a.DT_UINT32}}}const yr=1495978707e-1,Xt=Math.PI/180;function Us(r){return r/864e5+24405875e-1}function nl(r){return(Us(r)-2451545)/36525}const qu={mercury:[[.38709927,.20563593,7.00497902,252.2503235,77.45779628,48.33076593],[37e-8,1906e-8,-.00594749,149472.67411175,.16047689,-.12534081]],venus:[[.72333566,.00677672,3.39467605,181.9790995,131.60246718,76.67984255],[39e-7,-4107e-8,-7889e-7,58517.81538729,.00268329,-.27769418]],emb:[[1.00000261,.01671123,-1531e-8,100.46457166,102.93768193,0],[562e-8,-4392e-8,-.01294668,35999.37244981,.32327364,0]],mars:[[1.52371034,.0933941,1.84969142,-4.55343205,-23.94362959,49.55953891],[1847e-8,7882e-8,-.00813131,19140.30268499,.44441088,-.29257343]],jupiter:[[5.202887,.04838624,1.30439695,34.39644051,14.72847983,100.47390909],[-11607e-8,-13253e-8,-.00183714,3034.74612775,.21252668,.20469106]],saturn:[[9.53667594,.05386179,2.48599187,49.95424423,92.59887831,113.66242448],[-.0012506,-50991e-8,.00193609,1222.49362201,-.41897216,-.28867794]],uranus:[[19.18916464,.04725744,.77263783,313.23810451,170.9542763,74.01692503],[-.00196176,-4397e-8,-.00242939,428.48202785,.40805281,.04240589]],neptune:[[30.06992276,.00859048,1.77004347,-55.12002969,44.96476227,131.78422574],[26291e-8,5105e-8,35372e-8,218.45945325,-.32241464,-.00508664]],pluto:[[39.48211675,.2488273,17.14001206,238.92903833,224.06891629,110.30393684],[-31596e-8,517e-7,4818e-8,145.20780515,-.04062942,-.01183482]]};function ju(r,e){const n=((r%360+540)%360-180)*Xt;let i=n+e*Math.sin(n);for(let s=0;s<12;s++){const a=(i-e*Math.sin(i)-n)/(1-e*Math.cos(i));if(i-=a,Math.abs(a)<1e-12)break}return i}function Qu(r,e){const[t,n]=qu[r],[i,s,a,o,l,c]=t.map((u,h)=>u+n[h]*e);return{a:i,e:s,I:a,L:o,wbar:l,node:c}}function Cs(r,e,t,n,i,s){const a=(n-i)*Xt,o=i*Xt,l=t*Xt,c=r*(Math.cos(s)-e),u=r*Math.sqrt(1-e*e)*Math.sin(s),h=Math.cos(a),d=Math.sin(a),f=Math.cos(o),_=Math.sin(o),g=Math.cos(l),m=Math.sin(l);return[(h*f-d*_*g)*c+(-d*f-h*_*g)*u,(h*_+d*f*g)*c+(-d*_+h*f*g)*u,d*m*c+h*m*u]}function Gc(r,e){const{a:t,e:n,I:i,L:s,wbar:a,node:o}=Qu(r,e);return Cs(t,n,i,a,o,ju(s-a,n))}const Fs={};function eM(r,e){Fs[r]=e}function tM(r,e){const t=Fs[r],n=.9856076686/Math.pow(t.a,1.5),i=t.ma+n*(Us(e)-t.epochJD);return Cs(t.a,t.e,t.i,t.w+t.om,t.om,ju(i,t.e))}function FM(r,e,t=360){const n=Fs[r];if(n)return Array.from({length:t+1},(u,h)=>Cs(n.a,n.e,n.i,n.w+n.om,n.om,h/t*2*Math.PI));const i=r==="earth"?"emb":r,{a:s,e:a,I:o,wbar:l,node:c}=Qu(i,nl(e));return Array.from({length:t+1},(u,h)=>Cs(s,a,o,l,c,h/t*2*Math.PI))}function BM(r){return Fs[r]?.a??qu[r==="earth"?"emb":r]?.[0][0]??0}function Yu(r){const e=nl(r),t=c=>Math.sin(c*Xt),n=c=>Math.cos(c*Xt),i=218.32+481267.881*e+6.29*t(134.9+477198.85*e)-1.27*t(259.2-413335.38*e)+.66*t(235.7+890534.23*e)+.21*t(269.9+954397.7*e)-.19*t(357.5+35999.05*e)-.11*t(186.6+966404.05*e),s=5.13*t(93.3+483202.03*e)+.28*t(228.2+960400.87*e)-.28*t(318.3+6003.18*e)-.17*t(217.6-407332.2*e),a=.9508+.0518*n(134.9+477198.85*e)+.0095*n(259.2-413335.38*e)+.0078*n(235.7+890534.23*e)+.0028*n(269.9+954397.7*e),l=6378.14/Math.sin(a*Xt)/yr;return[l*n(s)*n(i),l*n(s)*t(i),l*t(s)]}function nM(r,e){const t=nl(e);if(r==="earth"){const n=Gc("emb",t),i=Yu(e),s=1/82.3;return[n[0]-i[0]*s,n[1]-i[1]*s,n[2]-i[2]*s]}return Gc(r,t)}function iM(r,e,t){const n=Us(e)-24430005e-1,i=(r.l0+360/r.periodDays*n)*Xt,s=r.aKm/yr,a=r.incl*Xt;return[t[0]+s*Math.cos(i),t[1]+s*Math.sin(i)*Math.cos(a),t[2]+s*Math.sin(i)*Math.sin(a)]}function kM(r){return((280.46061837+360.98564736629*(Us(r)-2451545))%360+360)%360*Xt}const Vc=23.4393*Xt;function zM([r,e,t]){const n=Math.cos(Vc),i=Math.sin(Vc);return[r/yr,(e*n+t*i)/yr,(-e*i+t*n)/yr]}const HM=r=>Math.hypot(r[0],r[1],r[2]),GM=(r,e)=>[r[0]-e[0],r[1]-e[1],r[2]-e[2]],Bs=(r,e)=>[r[0]+e[0],r[1]+e[1],r[2]+e[2]],wo=(r,e)=>[r[0]*e,r[1]*e,r[2]*e];function rM(r,e,t){const n=r*Xt,i=e*Xt;return[t*Math.cos(i)*Math.cos(n),t*Math.cos(i)*Math.sin(n),t*Math.sin(i)]}const il=88775244;let rl=null,Wc=null;const Xc=()=>rl;function VM(){return Wc??=ad("mars/traverse.json",async()=>{const r=await fetch("./data/mars-traverse.json");if(!r.ok)throw new Error("mars traverse unavailable");return r.json()}).then(r=>rl=r).catch(r=>(console.warn("Mars-Fahrspuren",r),null)),Wc}function sM(r,e){const t=Date.parse(r.sol0),n=(e-t)/il;let i=0,s=r.sol.length;for(;i<s;){const a=i+s>>1;r.sol[a]<=n?i=a+1:s=a}return i}function Kc(r,e){if(!r)return null;const t=sM(r,e);return t?[r.ll[(t-1)*2],r.ll[(t-1)*2+1]]:null}function aM(r){const e=rl?.heli;if(!e?.flights.length)return null;const t=Date.parse(e.sol0);let n=null;for(const i of e.flights)t+i.sol*il<=r&&(n=i);if(!n){const i=e.flights[0].pts;return[i[0],i[1]]}return[n.pts[n.pts.length-2],n.pts[n.pts.length-1]]}const WM=(r,e)=>Math.floor((r-Date.parse(e))/il),XM=[{id:"viking1",body:"mars",name:"Viking 1",flag:"us",date:"1976-07-20T11:53Z",lat:22.27,lon:-47.95,region:"Chryse Planitia",text:"Erste erfolgreiche Landung auf dem Mars: Der Lander arbeitete über sechs Jahre und schickte die ersten Farbbilder von der Oberfläche."},{id:"viking2",body:"mars",name:"Viking 2",flag:"us",date:"1976-09-03T22:37Z",lat:47.67,lon:134.26,region:"Utopia Planitia",text:"Zweiter Viking-Lander; seine Kamera zeigte erstmals Raureif auf dem Marsboden."},{id:"pathfinder",body:"mars",name:"Mars Pathfinder",flag:"us",date:"1997-07-04T16:57Z",lat:19.13,lon:-33.22,craft:"Rover Sojourner",region:"Ares Vallis",text:"Brachte mit „Sojourner“ den ersten Rover auf den Mars und landete – airbaggedämpft – in einer Mündungsebene."},{id:"spirit",body:"mars",name:"Spirit (MER-A)",flag:"us",date:"2004-01-04T04:35Z",lat:-14.57,lon:175.47,craft:"Mars Exploration Rover",region:"Gusev-Krater",text:"Sollte 90 Tage arbeiten und fuhr über sechs Jahre, bis er in weichem Sand stecken blieb (2010)."},{id:"opportunity",body:"mars",name:"Opportunity (MER-B)",flag:"us",date:"2004-01-25T05:05Z",lat:-1.95,lon:-5.53,craft:"Mars Exploration Rover",region:"Meridiani Planum",text:"Fuhr fast 45 km – Rekord für ein außerirdisches Fahrzeug – und fand Hinweise auf früheres flüssiges Wasser. Kontakt 2018 nach einem Staubsturm verloren."},{id:"phoenix",body:"mars",name:"Phoenix",flag:"us",date:"2008-05-25T23:53Z",lat:68.22,lon:-125.7,region:"Vastitas Borealis (Nordpolarebene)",text:"Grub im Nordpolargebiet und bestätigte Wassereis dicht unter dem Marsboden."},{id:"curiosity",body:"mars",name:"Curiosity (MSL)",flag:"us",date:"2012-08-06T05:17Z",lat:-4.5895,lon:137.4417,craft:"Rover Curiosity",region:"Gale-Krater, Aeolis Palus",hideFlag:!0,text:"Der atomgetriebene Rover erkundet seit 2012 den Mount Sharp im Gale-Krater und fand organische Moleküle sowie Spuren eines früheren Sees."},{id:"insight",body:"mars",name:"InSight",flag:"us",date:"2018-11-26T19:53Z",lat:4.502,lon:135.623,region:"Elysium Planitia",text:"Stationärer Lander mit Seismometer: zeichnete über 1 300 Marsbeben auf und vermaß den Aufbau des Planeteninneren."},{id:"perseverance",body:"mars",name:"Perseverance (Mars 2020)",flag:"us",date:"2021-02-18T20:55Z",lat:18.4446,lon:77.4509,craft:"Rover Perseverance, Hubschrauber Ingenuity",region:"Jezero-Krater",hideFlag:!0,text:"Sammelt Gesteinsproben für eine spätere Rückführung zur Erde. Der mitgebrachte Hubschrauber Ingenuity absolvierte 72 Flüge (2021–2024)."},{id:"zhurong",body:"mars",name:"Tianwen-1 / Zhurong",flag:"cn",date:"2021-05-14T23:18Z",lat:25.066,lon:109.925,craft:"Rover Zhurong",region:"Utopia Planitia",text:"Chinas erste Marslandung gelang gleich im ersten Anlauf; der Rover fuhr rund 1,9 km."}],qc=2*Math.PI*3389500/360,jc=new WeakMap;function KM(r,e){let t=jc.get(r);if(!t){const n=r.sol.length;t=new Float64Array(n);for(let i=1;i<n;i++){const s=r.ll[i*2+1],a=(r.ll[i*2]-r.ll[(i-1)*2])*Math.cos(s*Math.PI/180)*qc,o=(s-r.ll[(i-1)*2+1])*qc;t[i]=t[i-1]+Math.hypot(a,o)/1e3}jc.set(r,t)}return e>0?t[Math.min(e,t.length)-1]:0}const $n=7,oM=864e5;let sl=null,La=null;function qM(){return La??=fetch("./data/spacecraft.json").then(r=>r.ok?r.json():Promise.reject(new Error(`HTTP ${r.status}`))).then(r=>(sl=r.craft,!0)).catch(r=>(console.warn("Sondenbahnen",r),La=null,!1)),La}function lM(r,e){const t=sl?.[r];if(!t||t.length<2*$n)return null;const n=t.length/$n;if(e<t[0]||e>t[(n-1)*$n])return null;let i=0,s=n-1;for(;s-i>1;){const p=i+s>>1;t[p*$n]<=e?i=p:s=p}const a=i*$n,o=s*$n,l=(t[o]-t[a])/oM,c=(e-t[a])/(t[o]-t[a]),u=c*c,h=u*c,d=2*h-3*u+1,f=h-2*u+c,_=-2*h+3*u,g=h-u,m=[0,0,0];for(let p=0;p<3;p++)m[p]=d*t[a+1+p]+f*l*t[a+4+p]+_*t[o+1+p]+g*l*t[o+4+p];return m}function jM(r){const e=sl?.[r];if(!e||e.length<2*$n)return null;const t=[];for(let n=0;n<e.length;n+=$n)t.push(e[n]);return t}const We=r=>`./textures/${r}`,Pn=r=>e=>nM(r,e),xt=r=>({position:(e,t)=>iM(r,e,t(r.parent)),periodDays:r.periodDays}),cM={ceres:{a:2.77,e:.0797,i:10.6,om:80.2,w:73.3,ma:274,epochJD:24612005e-1},vesta:{a:2.36,e:.0902,i:7.14,om:104,w:151,ma:81.2,epochJD:24612005e-1},eris:{a:67.9,e:.438,i:43.9,om:36,w:151,ma:212,epochJD:24612005e-1},haumea:{a:43.1,e:.194,i:28.2,om:122,w:241,ma:223,epochJD:24612005e-1},makemake:{a:45.6,e:.159,i:29,om:79.3,w:297,ma:170,epochJD:24612005e-1},eros:{a:1.46,e:.223,i:10.8,om:304,w:179,ma:62.5,epochJD:24612005e-1},bennu:{a:1.13,e:.204,i:6.03,om:2.06,w:66.2,ma:102,epochJD:24555625e-1},itokawa:{a:1.32,e:.28,i:1.62,om:69.1,w:163,ma:171,epochJD:24612005e-1},kleopatra:{a:2.8,e:.25,i:13.1,om:215,w:180,ma:260,epochJD:24612005e-1},geographos:{a:1.25,e:.336,i:13.3,om:337,w:277,ma:355,epochJD:24612005e-1},toutatis:{a:2.54,e:.625,i:.448,om:125,w:278,ma:126,epochJD:24612005e-1},mithra:{a:2.21,e:.66,i:3.03,om:82.2,w:169,ma:336,epochJD:24612005e-1},golevka:{a:2.47,e:.619,i:2.26,om:209,w:69.8,ma:303,epochJD:24612005e-1},hw1:{a:2.05,e:.449,i:8.45,om:177,w:177,ma:21.7,epochJD:24612005e-1}};for(const[r,e]of Object.entries(cM))eM(r,e);const Bt=r=>e=>tM(r,e),uM=[{id:"sun",name:"Sonne",kind:"star",radiusKm:696340,color:"#ffcc55",texture:We("8k_sun.jpg"),tiltDeg:7.25,rotationHours:609.12,position:()=>[0,0,0],facts:[["Durchmesser","1 392 684 km (109 × Erde)"],["Masse","333 000 × Erde"],["Oberflächentemperatur","≈ 5 500 °C"],["Alter","≈ 4,6 Mrd. Jahre"]],description:"Unser Stern – ein gelber Zwerg, der 99,86 % der Masse des Sonnensystems enthält."},{id:"mercury",name:"Merkur",kind:"planet",radiusKm:2439.7,color:"#a39e98",texture:We("8k_mercury.jpg"),bumpMap:We("8k_mercury.jpg"),bumpScale:.015,tiltDeg:.03,rotationHours:1407.6,position:Pn("mercury"),orbit:!0,facts:[["Durchmesser","4 879 km"],["Umlaufzeit","88 Tage"],["Tageslänge","176 Erdtage (Sonnentag)"],["Temperatur","−173 bis +427 °C"],["Schwerkraft","3,7 m/s²"],["Monde","keine"]],description:"Der kleinste und sonnennächste Planet, ohne nennenswerte Atmosphäre."},{id:"venus",name:"Venus",kind:"planet",radiusKm:6051.8,color:"#e8c785",texture:We("8k_venus_surface.jpg"),tiltDeg:177.4,rotationHours:-5832.5,position:Pn("venus"),orbit:!0,facts:[["Durchmesser","12 104 km"],["Umlaufzeit","225 Tage"],["Tageslänge","117 Erdtage, rückläufig"],["Temperatur","≈ 464 °C"],["Luftdruck","92 bar (CO₂)"],["Monde","keine"]],description:"Der heißeste Planet – eine dichte CO₂-Atmosphäre sorgt für einen extremen Treibhauseffekt."},{id:"earth",name:"Erde",kind:"planet",radiusKm:6371,color:"#4f8cff",texture:We("8k_earth_daymap.jpg"),tiltDeg:23.44,rotationHours:23.9345,position:Pn("earth"),orbit:!0,facts:[["Durchmesser","12 742 km"],["Umlaufzeit","365,25 Tage"],["Tageslänge","24 h"],["Mittlere Temperatur","≈ 15 °C"],["Schwerkraft","9,81 m/s²"],["Monde","1"]],description:"Unser Heimatplanet. Hineinzoomen öffnet die Wetterkarte."},{id:"moon",name:"Mond",kind:"moon",parent:"earth",radiusKm:1737.4,color:"#c9c9c9",texture:We("8k_moon.jpg"),bumpMap:We("8k_moon.jpg"),bumpScale:.012,tiltDeg:6.68,position:(r,e)=>Bs(e("earth"),Yu(r)),periodDays:27.32,facts:[["Durchmesser","3 474 km"],["Entfernung zur Erde","≈ 384 400 km"],["Umlaufzeit","27,3 Tage"],["Schwerkraft","1,62 m/s²"]],description:"Der Erdmond zeigt uns wegen der gebundenen Rotation immer dieselbe Seite."},{id:"mars",name:"Mars",kind:"planet",radiusKm:3389.5,color:"#d0643c",texture:We("8k_mars.jpg"),bumpMap:We("8k_mars.jpg"),bumpScale:.02,tiltDeg:25.19,rotationHours:24.623,position:Pn("mars"),orbit:!0,facts:[["Durchmesser","6 779 km"],["Umlaufzeit","687 Tage"],["Tageslänge","24 h 37 min"],["Temperatur","≈ −65 °C"],["Schwerkraft","3,71 m/s²"],["Monde","2 (Phobos, Deimos)"]],description:"Der rote Planet mit dem höchsten Vulkan (Olympus Mons) und dem größten Canyon des Sonnensystems."},{id:"phobos",name:"Phobos",kind:"moon",parent:"mars",radiusKm:11.27,color:"#8a7a6a",texture:We("moons/phobos.jpg"),...xt({parent:"mars",aKm:9376,periodDays:.31891,l0:0,incl:26})},{id:"deimos",name:"Deimos",kind:"moon",parent:"mars",radiusKm:6.2,color:"#9a8a7a",texture:We("moons/deimos.jpg"),...xt({parent:"mars",aKm:23463,periodDays:1.26244,l0:120,incl:26})},{id:"jupiter",name:"Jupiter",kind:"planet",radiusKm:69911,color:"#d9b38c",texture:We("8k_jupiter.jpg"),tiltDeg:3.13,rotationHours:9.925,position:Pn("jupiter"),orbit:!0,facts:[["Durchmesser","139 820 km (11 × Erde)"],["Umlaufzeit","11,9 Jahre"],["Tageslänge","9 h 56 min"],["Temperatur","≈ −110 °C (Wolkenobergrenze)"],["Schwerkraft","24,8 m/s²"],["Monde","95"]],description:"Der größte Planet – ein Gasriese mit dem Großen Roten Fleck, einem seit Jahrhunderten tobenden Sturm."},{id:"io",name:"Io",kind:"moon",parent:"jupiter",radiusKm:1821.6,color:"#e8d36a",texture:We("moons/io.jpg"),...xt({parent:"jupiter",aKm:421700,periodDays:1.769138,l0:106.07719,incl:2.2}),description:"Der vulkanisch aktivste Körper im Sonnensystem."},{id:"europa",name:"Europa",kind:"moon",parent:"jupiter",radiusKm:1560.8,color:"#d8cbb0",texture:We("moons/europa.jpg"),...xt({parent:"jupiter",aKm:671034,periodDays:3.551181,l0:175.73161,incl:2.2}),description:"Unter dem Eispanzer liegt vermutlich ein globaler Ozean aus flüssigem Wasser."},{id:"ganymede",name:"Ganymed",kind:"moon",parent:"jupiter",radiusKm:2634.1,color:"#a99c8c",texture:We("moons/ganymede.jpg"),...xt({parent:"jupiter",aKm:1070412,periodDays:7.15455,l0:120.55883,incl:2.2}),description:"Der größte Mond des Sonnensystems – größer als der Planet Merkur."},{id:"callisto",name:"Kallisto",kind:"moon",parent:"jupiter",radiusKm:2410.3,color:"#7d7468",texture:We("moons/callisto.jpg"),...xt({parent:"jupiter",aKm:1882709,periodDays:16.689,l0:84.44459,incl:2.2})},{id:"saturn",name:"Saturn",kind:"planet",radiusKm:58232,color:"#e3cf98",texture:We("8k_saturn.jpg"),tiltDeg:26.73,rotationHours:10.656,position:Pn("saturn"),orbit:!0,facts:[["Durchmesser","116 460 km"],["Umlaufzeit","29,5 Jahre"],["Tageslänge","10 h 39 min"],["Temperatur","≈ −140 °C"],["Schwerkraft","10,4 m/s²"],["Monde","146"]],description:"Der Ringplanet – seine Ringe bestehen aus Eisbrocken und sind nur etwa 10 m bis 1 km dick."},{id:"titan",name:"Titan",kind:"moon",parent:"saturn",radiusKm:2574.7,color:"#d9a650",texture:We("moons/titan.jpg"),...xt({parent:"saturn",aKm:1221870,periodDays:15.945,l0:30,incl:27}),description:"Der einzige Mond mit dichter Atmosphäre und Seen aus flüssigem Methan."},{id:"uranus",name:"Uranus",kind:"planet",radiusKm:25362,color:"#a6e3ea",texture:We("uranusmap.jpg"),tiltDeg:97.77,rotationHours:-17.24,position:Pn("uranus"),orbit:!0,facts:[["Durchmesser","50 724 km"],["Umlaufzeit","84 Jahre"],["Tageslänge","17 h 14 min, rückläufig"],["Temperatur","≈ −195 °C"],["Achsneigung","98° – rollt um die Sonne"],["Monde","28"]],description:"Ein Eisriese, der praktisch auf der Seite liegend um die Sonne läuft."},{id:"neptune",name:"Neptun",kind:"planet",radiusKm:24622,color:"#4b70dd",texture:We("neptunemap.jpg"),tiltDeg:28.32,rotationHours:16.11,position:Pn("neptune"),orbit:!0,facts:[["Durchmesser","49 244 km"],["Umlaufzeit","165 Jahre"],["Tageslänge","16 h 6 min"],["Temperatur","≈ −200 °C"],["Windgeschwindigkeit","bis 2 100 km/h"],["Monde","16"]],description:"Der äußerste Planet – mit den schnellsten Winden im Sonnensystem."},{id:"pluto",name:"Pluto",kind:"dwarf",radiusKm:1188.3,color:"#cdb79e",texture:We("moons/pluto.jpg"),tiltDeg:122.5,rotationHours:-153.3,position:Pn("pluto"),orbit:!0,facts:[["Durchmesser","2 377 km"],["Umlaufzeit","248 Jahre"],["Temperatur","≈ −225 °C"],["Monde","5 (u. a. Charon)"]],description:"Zwergplanet im Kuipergürtel, 2015 von New Horizons besucht."},{id:"mimas",name:"Mimas",kind:"moon",parent:"saturn",radiusKm:198.2,color:"#bdbdbd",texture:We("moons/mimas.jpg"),rotationHours:22.61,approx:!0,...xt({parent:"saturn",aKm:185520,periodDays:.942,l0:236,incl:27}),description:"Der kleinste und innerste der großen Saturnmonde – der riesige Herschel-Krater erinnert an den „Todesstern“."},{id:"enceladus",name:"Enceladus",kind:"moon",parent:"saturn",radiusKm:252.1,color:"#f2f4f6",texture:We("moons/enceladus.jpg"),rotationHours:32.88,approx:!0,...xt({parent:"saturn",aKm:238020,periodDays:1.37,l0:230,incl:27}),description:"Eisgeysire am Südpol speisen den E-Ring; unter dem Eis liegt ein Ozean – ein Kandidat für außerirdisches Leben."},{id:"tethys",name:"Tethys",kind:"moon",parent:"saturn",radiusKm:531.1,color:"#d8d8d8",texture:We("moons/tethys.jpg"),rotationHours:45.31,approx:!0,...xt({parent:"saturn",aKm:294660,periodDays:1.888,l0:357,incl:27}),description:"Fast reines Eis, geprägt vom Odysseus-Krater und dem Canyon Ithaca Chasma."},{id:"dione",name:"Dione",kind:"moon",parent:"saturn",radiusKm:561.4,color:"#cfcfcf",texture:We("moons/dione.jpg"),rotationHours:65.69,approx:!0,...xt({parent:"saturn",aKm:377400,periodDays:2.737,l0:173,incl:27}),description:"Eismond mit hellen Eisklippen auf der Rückseite und Spuren möglicher Geologie im Inneren."},{id:"rhea",name:"Rhea",kind:"moon",parent:"saturn",radiusKm:763.8,color:"#c8c8c8",texture:We("moons/rhea.jpg"),rotationHours:108.43,approx:!0,...xt({parent:"saturn",aKm:527040,periodDays:4.518,l0:25,incl:27}),description:"Zweitgrößter Saturnmond, stark verkratert und fast nur aus Wassereis."},{id:"iapetus",name:"Iapetus",kind:"moon",parent:"saturn",radiusKm:734.5,color:"#a8a090",texture:We("moons/iapetus.jpg"),rotationHours:1903.92,approx:!0,...xt({parent:"saturn",aKm:3560820,periodDays:79.33,l0:260,incl:17}),description:"Zweifarbig: eine Hälfte pechschwarz, die andere hell – dazu ein 20 km hoher Äquatorgrat."},{id:"miranda",name:"Miranda",kind:"moon",parent:"uranus",radiusKm:235.8,color:"#b8b8b8",texture:We("moons/miranda.jpg"),rotationHours:33.91,approx:!0,...xt({parent:"uranus",aKm:129390,periodDays:1.413,l0:165,incl:98}),description:"Der zerklüftetste Uranusmond mit Canyons, die bis zu 20 km tief sind."},{id:"ariel",name:"Ariel",kind:"moon",parent:"uranus",radiusKm:578.9,color:"#c8c8c8",texture:We("moons/ariel.jpg"),rotationHours:60.48,approx:!0,...xt({parent:"uranus",aKm:191020,periodDays:2.52,l0:194,incl:98}),description:"Hellster Uranusmond mit Tälern und Gräben aus Eis."},{id:"umbriel",name:"Umbriel",kind:"moon",parent:"uranus",radiusKm:584.7,color:"#7e7e7e",texture:We("moons/umbriel.jpg"),rotationHours:99.46,approx:!0,...xt({parent:"uranus",aKm:266300,periodDays:4.144,l0:36,incl:98}),description:"Dunkelster der großen Uranusmonde mit einem rätselhaften hellen Ring im Krater Wunda."},{id:"titania",name:"Titania",kind:"moon",parent:"uranus",radiusKm:788.9,color:"#b0aca4",texture:We("moons/titania.jpg"),rotationHours:208.94,approx:!0,...xt({parent:"uranus",aKm:435910,periodDays:8.706,l0:20,incl:98}),description:"Größter Uranusmond, durchzogen von gewaltigen Gräben."},{id:"oberon",name:"Oberon",kind:"moon",parent:"uranus",radiusKm:761.4,color:"#a49c94",texture:We("moons/oberon.jpg"),rotationHours:323.11,approx:!0,...xt({parent:"uranus",aKm:583520,periodDays:13.463,l0:324,incl:98}),description:"Äußerer großer Uranusmond, uralt und stark verkratert."},{id:"triton",name:"Triton",kind:"moon",parent:"neptune",radiusKm:1353.4,color:"#e0d4cc",texture:We("moons/triton.jpg"),rotationHours:-141.05,approx:!0,...xt({parent:"neptune",aKm:354759,periodDays:-5.877,l0:77,incl:29}),description:"Größter Neptunmond: umkreist seinen Planeten rückläufig – vermutlich ein eingefangener Kuipergürtel-Körper mit Stickstoffgeysiren."},{id:"charon",name:"Charon",kind:"moon",parent:"pluto",radiusKm:606,color:"#9c9288",texture:We("moons/charon.jpg"),rotationHours:153.29,approx:!0,...xt({parent:"pluto",aKm:19591,periodDays:6.387,l0:299,incl:119}),description:"Pluto und Charon umkreisen einen gemeinsamen Schwerpunkt außerhalb Plutos und zeigen einander stets dieselbe Seite."},{id:"ceres",name:"Ceres",kind:"dwarf",radiusKm:469.7,color:"#9a948c",texture:We("moons/ceres.jpg"),rotationHours:9.074,position:Bt("ceres"),orbit:!0,facts:[["Durchmesser","939 km"],["Umlaufzeit","4,6 Jahre"],["Tageslänge","9,1 h"],["Besuch","Dawn (2015–2018)"]],description:"Der größte Körper im Asteroidengürtel und der einzige Zwergplanet im inneren Sonnensystem – 2015 von der Sonde Dawn erkundet."},{id:"vesta",name:"Vesta",kind:"asteroid",radiusKm:262.7,color:"#b3a89a",texture:We("moons/vesta.jpg"),rotationHours:5.342,position:Bt("vesta"),orbit:!0,facts:[["Durchmesser","≈ 525 km"],["Umlaufzeit","3,6 Jahre"],["Tageslänge","5,3 h"],["Besuch","Dawn (2011–2012)"]],description:"Zweitgrößter Körper des Asteroidengürtels mit dem riesigen Rheasilvia-Einschlagbecken am Südpol – von Dawn 2011/12 kartiert."},{id:"eris",name:"Eris",kind:"dwarf",radiusKm:1163,color:"#d8d4cc",position:Bt("eris"),orbit:!0,facts:[["Durchmesser","≈ 2 326 km"],["Umlaufzeit","≈ 559 Jahre"],["Mond","Dysnomia"]],description:"Massereichster bekannter Zwergplanet jenseits von Neptun, 2005 entdeckt – ihre Entdeckung führte zur Neudefinition des Planetenbegriffs. Keine Oberflächenkarte vorhanden."},{id:"haumea",name:"Haumea",kind:"dwarf",radiusKm:816,color:"#cfd0d4",rotationHours:3.915,position:Bt("haumea"),orbit:!0,facts:[["Durchmesser","≈ 1 600 × 1 000 km"],["Umlaufzeit","≈ 283 Jahre"],["Tageslänge","3,9 h"]],description:"Schnell rotierender, eiförmiger Zwergplanet im Kuipergürtel mit Ring und zwei Monden. Keine Oberflächenkarte vorhanden."},{id:"makemake",name:"Makemake",kind:"dwarf",radiusKm:715,color:"#c9a98c",position:Bt("makemake"),orbit:!0,facts:[["Durchmesser","≈ 1 430 km"],["Umlaufzeit","≈ 305 Jahre"],["Mond","S/2015 (136472) 1"]],description:"Heller, rötlicher Zwergplanet im Kuipergürtel. Keine Oberflächenkarte vorhanden."}],Fn=r=>Date.parse(r),dM=365.25*864e5;function _r(r,e,t,n,i){const s=Fn("2025-01-01"),a=Fn(i);return o=>o<a?null:rM(r,e,t+(o-s)/dM*n)}function In(r,e){return(t,n)=>lM(r,t)??e(t,n)}function Qc(r,e,t,n){const i=Fn(e),s=1/0;return(a,o)=>a<i||a>s?null:Bs(o(r),wo(t,1/1495978707e-1))}function hM(r,e,t,n,i,s){const a=uM.find(y=>y.id===r),o=(e+180)*Math.PI/180,l=(90-t)*Math.PI/180,c=-Math.cos(o)*Math.sin(l),u=Math.cos(l),h=Math.sin(o)*Math.sin(l),d=a.rotationHours?i/36e5/a.rotationHours%1*2*Math.PI:0,f=c*Math.cos(d)+h*Math.sin(d),_=-c*Math.sin(d)+h*Math.cos(d),g=-((a.tiltDeg??0)*Math.PI)/180,m=u*Math.cos(g)-_*Math.sin(g),p=u*Math.sin(g)+_*Math.cos(g),v=(a.radiusKm+n)/1495978707e-1;return Bs(s(r),[f*v,-p*v,m*v])}function wa(r,e,t,n){const i=Fn(e);return(s,a)=>{if(s<i)return null;const[o,l]=n?.(s)??t;return hM(r,o,l,8e-4,s,a)}}function Pa(r,e){const t=r.map(([n,i])=>({body:n,t:Fn(i)}));return(n,i)=>{if(n<t[0].t)return null;const s=t[t.length-1];if(n>=s.t)return e?Bs(i(e),[.002,0,0]):null;let a=0;for(;t[a+1].t<=n;)a++;const o=Po(t[a].body,t[a].t,i),l=Po(t[a+1].body,t[a+1].t,i),c=(n-t[a].t)/(t[a+1].t-t[a].t),u=Math.hypot(o[0],o[1]),h=Math.hypot(l[0],l[1]),d=Math.atan2(o[1],o[0]);let f=Math.atan2(l[1],l[0])-d;for(;f<0;)f+=2*Math.PI;const _=u+(h-u)*c,g=d+f*c;return[_*Math.cos(g),_*Math.sin(g),o[2]+(l[2]-o[2])*c]}}let Po=()=>[0,0,0];function QM(r){Po=r}let Io=()=>null;function YM(r){Io=r}const at=(r,e,t,n,i)=>({url:`./models/${r}`,sizeM:e,note:t,detailUrl:n?`./models/${n}`:void 0,detailRotY:i}),ZM=[{id:"eros",name:"Eros",kind:"asteroid",radiusKm:17.2,color:"#b0a090",model:{...at("eros.glb",34400),source:"NASA 3D Resources (Formmodell)"},position:Bt("eros"),orbit:!0,facts:[["Größe","34 × 11 × 11 km"],["Besuch","NEAR Shoemaker (2000–2001)"],["Umlaufzeit","1,8 Jahre"],["Rotation","5,3 h"]],description:"Erdnaher Asteroid, 1898 entdeckt und von NEAR Shoemaker 2000/01 umkreist – der erste Asteroid, auf dem eine Sonde landete."},{id:"bennu",name:"Bennu",kind:"asteroid",radiusKm:.2825,color:"#8a857c",model:{...at("bennu.glb",565),source:"NASA 3D Resources"},position:Bt("bennu"),orbit:!0,facts:[["Größe","≈ 490 m"],["Besuch","OSIRIS-REx (2018–2021)"],["Umlaufzeit","1,2 Jahre"],["Rotation","4,3 h"]],description:"Kohlenstoffreicher, erdnaher Asteroid – OSIRIS-REx nahm hier 2020 eine Probe und brachte sie 2023 zur Erde."},{id:"itokawa",name:"Itokawa",kind:"asteroid",radiusKm:.2675,color:"#a09585",model:{...at("itokawa.glb",535),source:"NASA 3D Resources (Formmodell)"},position:Bt("itokawa"),orbit:!0,facts:[["Größe","535 × 294 × 209 m"],["Besuch","Hayabusa (2005)"],["Umlaufzeit","1,5 Jahre"],["Rotation","12,1 h"]],description:"Erdnaher, erdnussförmiger Asteroid – von Hayabusa 2005 besucht, 2010 kamen erstmals Asteroidenproben zur Erde."},{id:"kleopatra",name:"Kleopatra",kind:"asteroid",radiusKm:108.5,color:"#a8a39a",model:{...at("kleopatra.glb",217e3),source:"NASA 3D Resources (Formmodell)"},position:Bt("kleopatra"),orbit:!0,facts:[["Größe","≈ 217 × 94 × 81 km"],["Umlaufzeit","4,7 Jahre"],["Rotation","5,4 h"]],description:"Knochenförmiger Metall-Asteroid im Hauptgürtel mit zwei kleinen Monden."},{id:"geographos",name:"Geographos",kind:"asteroid",radiusKm:2.55,color:"#9a9388",model:{...at("geographos.glb",5100),source:"NASA 3D Resources (Formmodell)"},position:Bt("geographos"),orbit:!0,facts:[["Größe","≈ 5,1 × 1,8 km"],["Umlaufzeit","1,4 Jahre"],["Rotation","5,2 h"]],description:"Extrem länglicher erdnaher Asteroid – einer der am stärksten gestreckten Körper des Sonnensystems."},{id:"toutatis",name:"Toutatis",kind:"asteroid",radiusKm:2.3,color:"#938c80",model:{...at("toutatis.glb",4600),source:"NASA 3D Resources (Radar-Formmodell)"},position:Bt("toutatis"),orbit:!0,facts:[["Größe","≈ 4,6 × 2,3 km"],["Besuch","Chang'e 2 (2012, Vorbeiflug)"],["Umlaufzeit","4,0 Jahre"],["Rotation","7 Tage"]],description:"Erdnaher Asteroid mit chaotischer Taumelbewegung; 2012 flog Chinas Chang'e 2 vorbei."},{id:"mithra",name:"Mithra",kind:"asteroid",radiusKm:1.35,color:"#8e877c",model:{...at("mithra.glb",2700),source:"NASA 3D Resources (Radar-Formmodell)"},position:Bt("mithra"),orbit:!0,facts:[["Größe","≈ 2,7 km"],["Umlaufzeit","3,3 Jahre"],["Rotation","3 Tage"]],description:"Erdnaher Apollo-Asteroid, per Radar vermessen."},{id:"golevka",name:"Golevka",kind:"asteroid",radiusKm:.265,color:"#948d82",model:{...at("golevka.glb",530),source:"NASA 3D Resources (Radar-Formmodell)"},position:Bt("golevka"),orbit:!0,facts:[["Größe","≈ 530 m"],["Umlaufzeit","3,9 Jahre"],["Rotation","6,0 h"]],description:"Kleiner erdnaher Asteroid – an ihm wurde der Yarkovsky-Effekt (Bahnänderung durch Wärmeabstrahlung) erstmals gemessen."},{id:"hw1",name:"1996 HW1",kind:"asteroid",radiusKm:1.9,color:"#8f887b",model:{...at("hw1.glb",3800),source:"NASA 3D Resources (Radar-Formmodell)"},position:Bt("hw1"),orbit:!0,facts:[["Größe","≈ 3,8 km"],["Umlaufzeit","2,9 Jahre"],["Rotation","8,8 h"]],description:"Doppelasteroid-ähnlicher „Kontaktbinär“ aus zwei verschmolzenen Körpern, per Radar vermessen."}],JM=[{id:"iss",name:"ISS",kind:"craft",parent:"earth",radiusKm:.055,color:"#ffffff",model:at("iss.glb",109,void 0,"iss-detail.glb",Math.PI/2),position:r=>Io("25544",r),facts:[["Bahnhöhe","≈ 420 km"],["Geschwindigkeit","≈ 27 600 km/h"],["Besatzung","seit November 2000 dauerhaft bewohnt"]],description:"Die Internationale Raumstation – Position live aus aktuellen Bahndaten (CelesTrak)."},{id:"hubble",name:"Hubble-Teleskop",kind:"craft",parent:"earth",radiusKm:.0066,color:"#d6dbe8",model:at("hubble-lite.glb",13.2,void 0,"hubble.glb"),position:r=>Io("20580",r),facts:[["Start","24. April 1990"],["Bahnhöhe","≈ 515 km"],["Spiegel","2,4 m"]],description:"Das berühmte Weltraumteleskop – Position live aus aktuellen Bahndaten (CelesTrak)."},{id:"voyager1",name:"Voyager 1",kind:"craft",model:at("voyager.glb",16),radiusKm:.002,color:"#ffd23f",position:In("voyager1",_r(255.6,35,164.9,3.57,"1981-01-01")),facts:[["Start","5. September 1977"],["Status","aktiv, im interstellaren Raum"],["Geschwindigkeit","≈ 61 000 km/h relativ zur Sonne"]],description:"Das am weitesten entfernte menschengemachte Objekt. Besuchte Jupiter und Saturn."},{id:"voyager2",name:"Voyager 2",kind:"craft",model:at("voyager.glb",16),radiusKm:.002,color:"#ffd23f",position:In("voyager2",_r(289.8,-32,138.2,3.25,"1990-01-01")),facts:[["Start","20. August 1977"],["Status","aktiv, im interstellaren Raum"]],description:"Einzige Sonde, die alle vier Gasriesen besucht hat (Jupiter, Saturn, Uranus, Neptun)."},{id:"newhorizons",name:"New Horizons",kind:"craft",model:at("newhorizons-lite.glb",2.2,void 0,"newhorizons.glb"),radiusKm:.002,color:"#ffd23f",position:In("newhorizons",_r(288,1.9,61.1,2.89,"2016-01-01")),facts:[["Start","19. Januar 2006"],["Pluto-Vorbeiflug","14. Juli 2015"],["Arrokoth-Vorbeiflug","1. Januar 2019"]],description:"Erkundete Pluto und das Kuipergürtel-Objekt Arrokoth."},{id:"pioneer10",name:"Pioneer 10",kind:"craft",model:at("pioneer-lite.glb",8,void 0,"pioneer.glb"),radiusKm:.002,color:"#b0b8c8",position:In("pioneer10",_r(77.2,3,137,2.51,"1980-01-01")),facts:[["Start","3. März 1972"],["Status","Kontakt 2003 verloren"]],description:"Erste Sonde, die den Asteroidengürtel durchquerte und Jupiter besuchte."},{id:"pioneer11",name:"Pioneer 11",kind:"craft",model:at("pioneer-lite.glb",8,"Modell: Pioneer 10 (baugleich)","pioneer.glb"),radiusKm:.002,color:"#b0b8c8",position:In("pioneer11",_r(284.7,13,114,2.37,"1991-01-01")),facts:[["Start","6. April 1973"],["Status","Kontakt 1995 verloren"]]},{id:"jwst",name:"James-Webb-Teleskop",kind:"craft",model:at("jwst-lite.glb",21,void 0,"jwst.glb"),radiusKm:.01,color:"#ffb84d",approx:!0,position:(r,e)=>r<Fn("2022-01-24")?null:wo(e("earth"),1.01003),facts:[["Start","25. Dezember 2021"],["Ort","Lagrange-Punkt L2, 1,5 Mio. km von der Erde"]],description:"Das größte Weltraumteleskop, beobachtet im Infrarot."},{id:"soho",name:"SOHO",kind:"craft",radiusKm:.004,model:at("soho.glb",9.5),color:"#ffb84d",approx:!0,position:(r,e)=>r<Fn("1996-02-14")?null:wo(e("earth"),.99),facts:[["Start","2. Dezember 1995"],["Ort","Lagrange-Punkt L1 zwischen Erde und Sonne"]],description:"Sonnenobservatorium von ESA und NASA."},{id:"parker",name:"Parker Solar Probe",kind:"craft",model:at("parker.glb",6),radiusKm:.002,color:"#ff7a45",position:In("parker",r=>{if(r<Fn("2024-11-07"))return null;const e=(.0459+.7316)/2,t=(.7316-.0459)/(.7316+.0459),n=365.256*Math.pow(e,1.5)*864e5,i=2*Math.PI*(r-Fn("2024-12-24T11:53:00Z"))/n;let s=i;for(let c=0;c<15;c++)s-=(s-t*Math.sin(s)-i)/(1-t*Math.cos(s));const a=e*(Math.cos(s)-t),o=e*Math.sqrt(1-t*t)*Math.sin(s),l=100*Math.PI/180;return[a*Math.cos(l)-o*Math.sin(l),a*Math.sin(l)+o*Math.cos(l),0]}),facts:[["Start","12. August 2018"],["Sonnennähe","6,2 Mio. km – näher als je ein Objekt zuvor"],["Höchstgeschwindigkeit","≈ 690 000 km/h"]],description:"Fliegt durch die Korona der Sonne."},{id:"juno",name:"Juno",kind:"craft",model:at("juno.glb",20),radiusKm:.002,color:"#ffd23f",approx:!0,position:Qc("jupiter","2016-07-05",[0,0,4e5]),facts:[["Start","5. August 2011"],["Ankunft am Jupiter","5. Juli 2016"]],description:"Umkreist Jupiter auf einer polaren Bahn."},{id:"perseverance",name:"Perseverance",kind:"craft",parent:"mars",surface:"mars",model:at("perseverance-lite.glb",3,void 0,"perseverance.glb"),radiusKm:.002,color:"#ff9966",position:wa("mars","2021-02-18",[77.4509,18.4446],r=>Kc(Xc()?.m20,r)),facts:[["Landung","18. Februar 2021, Jezero-Krater"],["Aufgabe","Suche nach Spuren früheren Lebens"]],description:"Der Rover sammelt Gesteinsproben für eine spätere Rückführung. Position und Fahrspur aus den Daten der NASA (MMGIS)."},{id:"ingenuity",name:"Ingenuity",kind:"craft",parent:"mars",surface:"mars",radiusKm:6e-4,color:"#ffd23f",position:wa("mars","2021-04-04",[77.451,18.4449],r=>aM(r)),facts:[["Erstflug","19. April 2021 – erster Motorflug auf einem anderen Planeten"],["Flüge","72 (letzter: 18. Januar 2024)"],["Status","Mission beendet, Rotorblatt beschädigt"]],description:"Der Mars-Hubschrauber – die Karte zeigt alle Flugrouten, der Punkt markiert seinen letzten Landeplatz."},{id:"curiosity",name:"Curiosity",kind:"craft",parent:"mars",surface:"mars",model:at("curiosity-lite.glb",3,void 0,"curiosity.glb"),radiusKm:.002,color:"#ff9966",position:wa("mars","2012-08-06",[137.4417,-4.5895],r=>Kc(Xc()?.msl,r)),facts:[["Landung","6. August 2012, Gale-Krater"]],description:"Der Rover erkundet den Mount Sharp im Gale-Krater. Position und Fahrspur aus den Daten der NASA (MMGIS)."},{id:"lro",name:"Lunar Reconnaissance Orbiter",kind:"craft",parent:"moon",radiusKm:.003,color:"#ffd23f",approx:!0,model:at("lro.glb",5),position:Qc("moon","2009-06-23",[0,0,1787]),facts:[["Start","18. Juni 2009"],["Bahnhöhe","≈ 50–200 km über dem Mond"]],description:"Kartiert den Mond in höchster Auflösung."},{id:"europaclipper",name:"Europa Clipper",kind:"craft",model:at("europaclipper-lite.glb",30.5,void 0,"europaclipper.glb"),radiusKm:.003,color:"#7ad3ff",position:In("europaclipper",Pa([["earth","2024-10-14"],["mars","2025-03-01"],["earth","2026-12-03"],["jupiter","2030-04-11"]],"jupiter")),facts:[["Start","14. Oktober 2024"],["Ankunft am Jupiter","April 2030"],["Route","Mars-Vorbeiflug 2025, Erd-Vorbeiflug 2026"]],description:"Soll Jupitermond Europa auf Bewohnbarkeit untersuchen."},{id:"juice",name:"JUICE",kind:"craft",radiusKm:.003,model:{...at("juice.glb",27),source:"ESA SPICE (Cosmographia-Modell)"},color:"#7ad3ff",position:In("juice",Pa([["earth","2023-04-14"],["earth","2024-08-20"],["venus","2025-08-31"],["earth","2026-09-29"],["earth","2029-01-18"],["jupiter","2031-07-21"]],"jupiter")),facts:[["Start","14. April 2023 (ESA)"],["Ankunft am Jupiter","Juli 2031"]],description:"ESA-Mission zu den Eismonden Ganymed, Kallisto und Europa."},{id:"bepicolombo",name:"BepiColombo",kind:"craft",radiusKm:.003,model:{...at("bepicolombo.glb",30),source:"ESA SPICE (Cosmographia-Modell)"},color:"#7ad3ff",position:In("bepicolombo",Pa([["earth","2018-10-20"],["earth","2020-04-10"],["venus","2020-10-15"],["venus","2021-08-10"],["mercury","2021-10-01"],["mercury","2022-06-23"],["mercury","2023-06-19"],["mercury","2024-09-04"],["mercury","2024-12-01"],["mercury","2025-01-08"],["mercury","2026-11-21"]],"mercury")),facts:[["Start","20. Oktober 2018 (ESA/JAXA)"],["Ankunft am Merkur","November 2026"]],description:"Europäisch-japanische Merkur-Mission."}],$M={us:"USA",su:"Sowjetunion",cn:"China",in:"Indien",jp:"Japan",eu:"Europa"},ex=[{id:"apollo11",name:"Apollo 11",flag:"us",date:"1969-07-20T20:17Z",lat:.67408,lon:23.47297,crewed:!0,crew:"Neil Armstrong, Buzz Aldrin (im Orbit: Michael Collins)",craft:"Mondfähre „Eagle“",region:"Mare Tranquillitatis (Meer der Ruhe)",text:"Die erste bemannte Mondlandung. „Das ist ein kleiner Schritt für einen Menschen, aber ein riesiger Sprung für die Menschheit.“ Der Laser-Reflektor wird bis heute zur Entfernungsmessung genutzt."},{id:"apollo12",name:"Apollo 12",flag:"us",date:"1969-11-19T06:54Z",lat:-3.01239,lon:-23.42157,crewed:!0,crew:"Pete Conrad, Alan Bean",craft:"Mondfähre „Intrepid“",region:"Oceanus Procellarum (Ozean der Stürme)",text:"Punktlandung nur 180 m neben der Sonde Surveyor 3 – Teile davon nahm die Crew mit zur Erde."},{id:"apollo14",name:"Apollo 14",flag:"us",date:"1971-02-05T09:18Z",lat:-3.6453,lon:-17.47136,crewed:!0,crew:"Alan Shepard, Edgar Mitchell",craft:"Mondfähre „Antares“",region:"Fra-Mauro-Hochland",text:"Alan Shepard schlug hier mit einem improvisierten Schläger zwei Golfbälle."},{id:"apollo15",name:"Apollo 15",flag:"us",date:"1971-07-30T22:16Z",lat:26.13222,lon:3.63386,crewed:!0,crew:"David Scott, James Irwin",craft:"Mondfähre „Falcon“, erstes Mondauto",region:"Hadley-Rille am Fuß der Mond-Apenninen",text:"Erstmals mit Mondauto. David Scott ließ Hammer und Feder gleichzeitig fallen – ohne Luft kamen beide gleichzeitig am Boden an."},{id:"apollo16",name:"Apollo 16",flag:"us",date:"1972-04-21T02:23Z",lat:-8.97301,lon:15.50019,crewed:!0,crew:"John Young, Charles Duke",craft:"Mondfähre „Orion“",region:"Descartes-Hochland",text:"Einzige Landung im zentralen Hochland. Charles Duke ließ ein Foto seiner Familie auf dem Mond zurück."},{id:"apollo17",name:"Apollo 17",flag:"us",date:"1972-12-11T19:54Z",lat:20.1908,lon:30.77168,crewed:!0,crew:"Eugene Cernan, Harrison Schmitt",craft:"Mondfähre „Challenger“",region:"Taurus-Littrow-Tal",text:"Die bisher letzten Menschen auf dem Mond. Harrison Schmitt war als Geologe der erste Wissenschaftler dort."},{id:"luna9",name:"Luna 9",flag:"su",date:"1966-02-03T18:45Z",lat:7.08,lon:-64.37,region:"Oceanus Procellarum",text:"Erste weiche Landung auf einem anderen Himmelskörper und erste Fotos von der Mondoberfläche."},{id:"surveyor1",name:"Surveyor 1",flag:"us",date:"1966-06-02T06:17Z",lat:-2.474,lon:-43.339,region:"Oceanus Procellarum",text:"Erste weiche Mondlandung der USA – Generalprobe für Apollo."},{id:"luna16",name:"Luna 16",flag:"su",date:"1970-09-20T05:18Z",lat:-.513,lon:56.364,region:"Mare Fecunditatis",text:"Erste robotische Probenrückführung: 101 g Mondboden kamen zur Erde."},{id:"luna17",name:"Luna 17",flag:"su",date:"1970-11-17T03:47Z",lat:38.238,lon:-35,craft:"Rover Lunochod 1",region:"Mare Imbrium",text:"Brachte Lunochod 1 – das erste ferngesteuerte Fahrzeug auf einem anderen Himmelskörper."},{id:"luna21",name:"Luna 21",flag:"su",date:"1973-01-15T22:35Z",lat:25.85,lon:30.45,craft:"Rover Lunochod 2",region:"Krater Le Monnier",text:"Lunochod 2 fuhr rund 39 km weit – Rekord bis 2014."},{id:"luna24",name:"Luna 24",flag:"su",date:"1976-08-18T06:36Z",lat:12.714,lon:62.213,region:"Mare Crisium",text:"Letzte sowjetische Mondmission, brachte 170 g Bohrkern zur Erde."},{id:"change3",name:"Chang’e 3",flag:"cn",date:"2013-12-14T13:11Z",lat:44.121,lon:-19.512,craft:"Rover Yutu („Jadehase“)",region:"Mare Imbrium",text:"Die erste weiche Mondlandung seit 37 Jahren."},{id:"change4",name:"Chang’e 4",flag:"cn",date:"2019-01-03T02:26Z",lat:-45.445,lon:177.599,craft:"Rover Yutu-2",region:"Von-Kármán-Krater (Rückseite)",text:"Erste Landung auf der Mondrückseite. Funkkontakt zur Erde nur über den Relaissatelliten Queqiao."},{id:"change5",name:"Chang’e 5",flag:"cn",date:"2020-12-01T15:11Z",lat:43.058,lon:-51.916,region:"Mons Rümker, Oceanus Procellarum",text:"Brachte 1,7 kg Proben zur Erde – das jüngste bisher untersuchte Mondgestein (≈ 2 Mrd. Jahre)."},{id:"change6",name:"Chang’e 6",flag:"cn",date:"2024-06-01T22:23Z",lat:-41.639,lon:-153.985,region:"Apollo-Becken (Rückseite)",text:"Erste Gesteinsproben von der Mondrückseite (1,9 kg)."},{id:"chandrayaan3",name:"Chandrayaan-3",flag:"in",date:"2023-08-23T12:33Z",lat:-69.373,lon:32.319,craft:"Lander Vikram, Rover Pragyan",region:"Südpolregion",text:"Indien landete als vierte Nation auf dem Mond – und als erste nahe dem Südpol."},{id:"slim",name:"SLIM",flag:"jp",date:"2024-01-19T15:20Z",lat:-13.316,lon:25.251,region:"Krater Shioli",text:"Japans „Mondscharfschütze“ landete auf etwa 10 m genau – allerdings kopfüber."},{id:"im1",name:"Odysseus (IM-1)",flag:"us",date:"2024-02-22T23:23Z",lat:-80.13,lon:1.44,craft:"Intuitive Machines",region:"Malapert A, Südpolregion",text:"Erste private Mondlandung; der Lander kippte dabei auf die Seite."},{id:"blueghost1",name:"Blue Ghost 1",flag:"us",date:"2025-03-02T08:34Z",lat:18.56,lon:61.81,craft:"Firefly Aerospace",region:"Mons Latreille, Mare Crisium",text:"Erste vollständig gelungene private Mondlandung; filmte einen Sonnenuntergang auf dem Mond."},{id:"im2",name:"Athena (IM-2)",flag:"us",date:"2025-03-06T17:28Z",lat:-84.5,lon:29.2,approx:!0,craft:"Intuitive Machines",region:"Mons Mouton, Südpolregion",text:"Landete am südlichsten Punkt aller bisherigen Missionen, kippte aber in einem Krater um."}];function No(r,e,t=new I){const n=(e+180)*Math.PI/180,i=(90-r)*Math.PI/180;return t.set(-Math.cos(n)*Math.sin(i),Math.cos(i),Math.sin(n)*Math.sin(i))}function ui(r,e,t,n,i=-Math.PI/2){r.beginPath();for(let s=0;s<10;s++){const a=i+s*Math.PI/5,o=s%2?n*.4:n;r.lineTo(e+Math.cos(a)*o,t+Math.sin(a)*o)}r.closePath(),r.fill()}function fM(r){const e=document.createElement("canvas"),t=e.width=152,n=e.height=96,i=e.getContext("2d");if(r==="us"){for(let s=0;s<13;s++)i.fillStyle=s%2?"#fff":"#b22234",i.fillRect(0,s*n/13,t,n/13+1);i.fillStyle="#3c3b6e",i.fillRect(0,0,t*.4,n*7/13),i.fillStyle="#fff";for(let s=0;s<5;s++)for(let a=0;a<6;a++)ui(i,6+a*9.5+s%2*4,6+s*9.5,2.6)}else if(r==="su")i.fillStyle="#cc0000",i.fillRect(0,0,t,n),i.fillStyle=i.strokeStyle="#ffd700",i.lineWidth=2,ui(i,26,13,6),i.lineWidth=3.5,i.beginPath(),i.arc(26,34,10,Math.PI*.9,Math.PI*2.25),i.stroke(),i.beginPath(),i.moveTo(17,46),i.lineTo(33,27),i.stroke(),i.fillRect(28,22,9,5);else if(r==="cn")i.fillStyle="#de2910",i.fillRect(0,0,t,n),i.fillStyle="#ffde00",ui(i,25,25,15),ui(i,50,9,5,.3),ui(i,60,19,5,.9),ui(i,60,33,5,1.6),ui(i,50,43,5,2.1);else if(r==="in"){["#ff9933","#ffffff","#138808"].forEach((s,a)=>{i.fillStyle=s,i.fillRect(0,a*n/3,t,n/3+1)}),i.strokeStyle="#000080",i.lineWidth=2,i.beginPath(),i.arc(t/2,n/2,12,0,Math.PI*2);for(let s=0;s<12;s++){const a=s*Math.PI/12;i.moveTo(t/2+Math.cos(a)*12,n/2+Math.sin(a)*12),i.lineTo(t/2-Math.cos(a)*12,n/2-Math.sin(a)*12)}i.stroke()}else i.fillStyle="#fff",i.fillRect(0,0,t,n),i.fillStyle="#bc002d",i.beginPath(),i.arc(t/2,n/2,n*.3,0,Math.PI*2),i.fill();return i.strokeStyle="rgba(0,0,0,0.35)",i.lineWidth=2,i.strokeRect(1,1,t-2,n-2),e}const Yc=new Map,Zu=r=>{let e=Yc.get(r);return e||Yc.set(r,e=fM(r)),e},tx=r=>Zu(r).toDataURL(),Zc=new Map;function pM(r){let e=Zc.get(r);return e||(e=new kh(Zu(r)),e.colorSpace=dt,Zc.set(r,e)),e}const Jc=new Dn({color:14211288});function mM(r){const e=new _n,t=new wt(new Pr(.018,.018,1,6),Jc);t.position.y=.5;const n=new Or(.62,.39,12,1),i=n.getAttribute("position");for(let o=0;o<i.count;o++){const l=i.getX(o)+.31;i.setZ(o,Math.sin(l*11)*.025*l)}n.computeVertexNormals();const s=new wt(n,new Dn({map:pM(r.flag),side:nn}));s.position.set(.31+.018,.79,0);const a=new wt(new Pr(.012,.012,.64,5),Jc);return a.rotation.z=Math.PI/2,a.position.set(.32,.985,0),e.add(t,s,a),e.traverse(o=>o.userData.site=r.id),e.visible=!1,e}const _M=6,$c=220,gM=r=>Math.min(.004,1e-8+.02*r);function MM(r,e,t){const n=180/2**r,i=90-e*n,s=-180+t*n,a=r<=2?32:16,o=1,l=[],c=[],u=[],h=new I;for(let _=0;_<=a;_++){const g=i-n*_/a;for(let m=0;m<=a;m++){const p=s+n*m/a;No(g,p,h),l.push(h.x*o,h.y*o,h.z*o),c.push(m/a,1-_/a),u.push((p+180)/360,(g+90)/180)}}const d=[];for(let _=0;_<a;_++)for(let g=0;g<a;g++){const m=_*(a+1)+g+1,p=_*(a+1)+g,v=(_+1)*(a+1)+g,y=(_+1)*(a+1)+g+1;d.push(m,p,y,p,v,y)}const f=new Pt;return f.setAttribute("position",new mt(l,3)),f.setAttribute("normal",new mt(l,3)),f.setAttribute("uv",new mt(c,2)),f.setAttribute("uv1",new mt(u,2)),f.setIndex(d),f}class nx{constructor(e,t){this.mesh=e,this.o=t,this.material=e.material,this.baseLevel=t.baseLevel,e.add(this.tileGroup),e.add(this.lineGroup);for(const n of t.sites){const i=mM(n);e.add(i);const s=document.createElement("div");s.className=`sp-label kind-site${n.crewed?" crewed":""}`,s.hidden=!0,s.innerHTML=`<span class="sp-name">${n.name}</span>`,s.addEventListener("click",a=>{a.stopPropagation(),t.onSite(n.id)}),t.labelHost.appendChild(s),this.flags.push({site:n,dir:No(n.lat,n.lon),obj:i,label:s,t:Date.parse(n.date),shown:!1})}}mesh;o;loader=new Uu;material;baseStage=0;baseLevel;normalMapTiles=null;tiles=new Map;tileGroup=new _n;lineGroup=new _n;loads=0;tileOk=0;tileFail=0;flags=[];selected=null;get screen(){return this.screenR}camLocal=new I;p=new I;v=new I;q=new vn;camUp=new I;bx=new I;bz=new I;basis=new Ne;frustum=new ws;sphere=new on;screenR=0;loadTex(e,t,n){this.loader.load(e,i=>{i.colorSpace=t?dt:Nn,i.anisotropy=this.o.anisotropy,n(i)},void 0,()=>{})}upgradeBase(){if(!this.o.upgradeBase)return;const e=this.material;this.baseStage<1&&this.screenR>50&&(this.baseStage=1,this.loadTex("./textures/moon/lroc-4k.jpg",!0,t=>{if(this.baseLevel>=4)return t.dispose();e.map?.dispose(),e.map=t,e.needsUpdate=!0,this.baseLevel=3}),this.loadTex("./textures/moon/normal-4k.jpg",!1,t=>{e.normalMap=t,e.normalScale.set(1,1),e.needsUpdate=!0,this.normalMapTiles=t.clone(),this.normalMapTiles.channel=1;for(const n of this.tiles.values())this.applyNormal(n)})),this.baseStage<2&&this.screenR>800&&this.o.maxTextureSize>=8192&&(this.baseStage=2,this.loadTex("./textures/moon/lroc-8k.jpg",!0,t=>{e.map?.dispose(),e.map=t,e.needsUpdate=!0,this.baseLevel=4}))}applyNormal(e){const t=e.mesh?.material;!t||!this.normalMapTiles||t.normalMap||(t.normalMap=this.normalMapTiles,t.needsUpdate=!0)}get tilesEnabled(){return!(this.tileOk===0&&this.tileFail>=8)}requestTile(e,t,n){const i=`${e}/${t}/${n}`,s={key:i,z:e,row:t,col:n,state:"loading"};this.tiles.set(i,s),this.loads++;const a=this.o.source(e);this.loader.load(a.url(e,t,n),o=>{if(this.loads--,this.tiles.get(i)!==s)return o.dispose();this.tileOk++,o.colorSpace=dt,o.anisotropy=this.o.anisotropy;const l=new wt(MM(e,t,n),new Ps({map:o,roughness:1,metalness:0,color:a.tint??16777215}));l.userData.id=this.o.body,l.visible=!1,s.mesh=l,s.state="ready",this.applyNormal(s),this.tileGroup.add(l)},void 0,()=>{this.loads--,this.tileFail++,s.state="error"})}wantedTiles(e,t){t.updateMatrixWorld(),this.frustum.setFromProjectionMatrix(this.basis.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse));const n=this.mesh.getWorldScale(this.bx).x,i=this.sphere,s=this.camLocal,a=s.length(),o=this.v.copy(s).divideScalar(a),l=Math.acos(Math.min(1,1/a)),c=[],u=new I,h=(d,f,_)=>{const g=180/2**d,m=90-(f+.5)*g,p=-180+(_+.5)*g;No(m,p,u);const v=Math.acos(Math.max(-1,Math.min(1,u.dot(o)))),y=Math.hypot(g,g*Math.min(1,Math.cos(Math.max(0,Math.abs(m)-g/2)*Math.PI/180)))/2*(Math.PI/180);if(v-y>l||(i.center.copy(u).applyMatrix4(this.mesh.matrixWorld),i.radius=2.2*Math.sin(y/2)*n,!this.frustum.intersectsSphere(i)))return;const E=Math.max(0,v-y),R=Math.max(a-1,Math.sqrt(a*a+1-2*a*Math.cos(E)));if(g*Math.PI/180/this.o.source(d).px/R*e>1.3&&d<this.o.maxZ)for(let x=0;x<2;x++)for(let b=0;b<2;b++)h(d+1,f*2+x,_*2+b);else d>this.baseLevel&&c.push([d,f,_])};for(let d=0;d<2;d++)h(0,0,d);return c}updateTiles(e,t){for(const a of this.tiles.values())a.mesh&&(a.mesh.visible=!1);if(this.screenR<150||!this.tilesEnabled)return;const n=this.wantedTiles(e,t);if(n.length>400)return;const i=new Set,s=[];for(const[a,o,l]of n){let c=a,u=o,h=l,d;for(;c>this.baseLevel;){const f=this.tiles.get(`${c}/${u}/${h}`);if(f?.state==="ready"){d=f;break}f||s.push([c,u,h]),c--,u>>=1,h>>=1}d&&i.add(d)}for(const a of i){let o=a.z-1,l=a.row>>1,c=a.col>>1;for(;o>this.baseLevel;){const u=this.tiles.get(`${o}/${l}/${c}`);if(u&&i.has(u)){i.delete(a);break}o--,l>>=1,c>>=1}}for(const a of i)a.mesh.visible=!0,this.tiles.delete(a.key),this.tiles.set(a.key,a);s.sort((a,o)=>a[0]-o[0]);for(const[a,o,l]of s){if(this.loads>=_M)break;this.tiles.has(`${a}/${o}/${l}`)||this.requestTile(a,o,l)}this.evict(i)}resetTiles(){for(const e of this.tiles.values()){if(!e.mesh)continue;this.tileGroup.remove(e.mesh),e.mesh.geometry.dispose();const t=e.mesh.material;t.map?.dispose(),t.dispose()}this.tiles.clear(),this.tileOk=0,this.tileFail=0}evict(e){if(!(this.tiles.size<=$c))for(const t of this.tiles.values()){if(this.tiles.size<=$c)break;if(!(e.has(t)||t.state==="loading")){if(t.mesh){this.tileGroup.remove(t.mesh),t.mesh.geometry.dispose();const n=t.mesh.material;n.map?.dispose(),n.dispose()}this.tiles.delete(t.key)}}}update(e,t,n,i){this.mesh.updateWorldMatrix(!0,!1),this.mesh.worldToLocal(this.camLocal.copy(e.position)),this.mesh.getWorldQuaternion(this.q).invert(),this.camUp.set(0,1,0).applyQuaternion(e.quaternion).applyQuaternion(this.q);const s=this.camLocal.length();this.screenR=s>1?n*Math.tan(Math.asin(1/s)):1e6,(!this.mesh.visible||!this.mesh.parent?.parent?.visible)&&(this.screenR=0),this.upgradeBase();const a=1+gM(s-1);this.tileGroup.scale.setScalar(a),this.lineGroup.scale.setScalar(1+(a-1)*1.6+15e-6),this.updateTiles(n,e);const o=this.v;for(const l of this.flags){const c=this.p.copy(l.dir),u=c.dot(this.camLocal);if(l.shown=i&&t>=l.t&&this.screenR>70&&u>1.0015,l.obj.visible=l.shown&&!l.site.hideFlag,!l.shown)continue;const h=(l.site.crewed?30:22)*Math.min(1,Math.max(.6,this.screenR/300))*(l.site.id===this.selected?1.25:1),d=this.camLocal.distanceTo(c),f=h*d/n;l.obj.scale.setScalar(f);const _=this.bz.copy(this.camLocal).sub(c).normalize(),g=o.copy(c).addScaledVector(_,-c.dot(_));l.obj.position.copy(c).multiplyScalar(a+f*.5*(1-Math.min(1,g.length()))),g.addScaledVector(this.camUp.clone().addScaledVector(_,-this.camUp.dot(_)),.35).normalize();const m=this.bx.crossVectors(g,_).normalize(),p=this.bz.crossVectors(m,g);l.obj.quaternion.setFromRotationMatrix(this.basis.makeBasis(m,g,p))}}updateLabels(e,t,n,i){for(const s of this.flags){const a=s.site.id===this.selected,o=s.shown&&(a||i&&this.screenR>(s.site.crewed?200:320));if(s.label.hidden=!o,!o)continue;const l=s.obj.localToWorld(this.v.set(0,1.05,0)).project(e);s.label.style.transform=`translate(${(l.x*.5+.5)*t}px, ${(-l.y*.5+.5)*n}px)`,s.label.classList.toggle("focused",a)}}}const xM=[["Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw","MGS MOLA and Mars Express HRSC, Color Hillshade Blend","base","~/tiles/Mars/EQ/Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw/1.0.0/default/default028mm/{z}/{r}/{c}.jpg",256,[-180,-89.999,179.998,90],8],["THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018","MO THEMIS-IR Day, Global Mosaic","base","~/tiles/Mars/EQ/THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-65.001,180,65.001],9],["JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0","MRO CTX, Jezero Mosaic, Controlled","mosaic","~/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[77.16,18.211,77.699,18.721],13],["ESP_042252_1930_RED_B_01_ORTHO","MRO HiRISE, Marth Crater West Rim Mosaic","mosaic","~/tiles/Mars/EQ/ESP_042252_1930_RED_B_01_ORTHO/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-4.319,12.451,-4.194,12.829],15],["ESP_042647_1760_RED_B_01_ORTHO","MRO HiRISE, Martian Ares 4 Landing Site Mosaic","mosaic","~/tiles/Mars/EQ/ESP_042647_1760_RED_B_01_ORTHO/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[15.151,-4.121,15.26,-3.813],15],["curiosity_hirise_mosaic","MRO HiRISE, Curiosity Roving Site Mosaic","mosaic","~/tiles/Mars/EQ/curiosity_hirise_mosaic/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[137.122,-4.925,137.73,-4.249],16],["HiRISE_ColumbiaHills","MRO HiRISE, Columbia Hills Mosaic","mosaic","~/tiles/Mars/EQ/HiRISE_ColumbiaHills/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[175.318,-14.847,175.797,-14.25],16],["PSP_001501_2280_RED","MRO HiRISE, Viking 2 Landing Site Mosaic","mosaic","~/tiles/Mars/EQ/PSP_001501_2280_RED/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[134.199,47.563,134.4,47.784],16],["ESP_040776_2115_RED_A_01_ORTHO","MRO HiRISE, Martian Ares 3 Landing Site Mosaic","mosaic","~/tiles/Mars/EQ/ESP_040776_2115_RED_A_01_ORTHO/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-28.693,31.239,-28.553,31.526],16],["PSP_001918_1735_RED_A_01_ORTHO_longlat","MRO HiRISE, Southwest Candor Chasma Mosaic","mosaic","~/tiles/Mars/EQ/PSP_001918_1735_RED_A_01_ORTHO_longlat/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-76.982,-6.561,-76.873,-6.378],16],["phoenix_hirise_mosaic","MRO HiRISE, Phoenix Landing Site Mosaic","mosaic","~/tiles/Mars/EQ/phoenix_hirise_mosaic/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-125.89,68.166,-125.661,68.25],16],["sojourner_hirise_mosaic","MRO HiRISE, Sojourner Roving Site Mosaic","mosaic","~/tiles/Mars/EQ/sojourner_hirise_mosaic/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-33.288,19.023,-33.209,19.16],16],["NES_JEZ_MID_Visible_Mosaic_HiRISE_CTX_HRSC_GCS_MARS_07-10-2018","MRO HiRISE, Mosaic Jezero NE Syrtis Midway","mosaic","~/tiles/Mars/EQ/NES_JEZ_MID_Visible_Mosaic_HiRISE_CTX_HRSC_GCS_MARS_07-10-2018/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[76.791,17.579,77.731,18.693],17],["HiRISE_Opportunity","MRO HiRISE, Mosaic Opportunity","mosaic","~/tiles/Mars/EQ/HiRISE_Opportunity/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-5.618,-2.834,-4.931,-1.89],17],["opportunity_hirise_mosaic","MRO HiRISE, Opportunity Roving Site Mosaic","mosaic","~/tiles/Mars/EQ/opportunity_hirise_mosaic/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-5.596,-2.751,-4.995,-1.899],17],["CLH_Visible_Mosaic_HiRISE_CTX_HRSC_GCS_MARS_07-10-2018","MRO HiRISE, Mosaic Columbia Hills","mosaic","~/tiles/Mars/EQ/CLH_Visible_Mosaic_HiRISE_CTX_HRSC_GCS_MARS_07-10-2018/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[175.175,-14.828,175.698,-14.322],17],["JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd","MRO HiRISE, Jezero Mosaic, Controlled","mosaic","~/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[77.223,18.307,77.584,18.669],17],["PSP_001521_2025_RED","MRO HiRISE, Viking 1 Landing Site Mosaic","mosaic","~/tiles/Mars/EQ/PSP_001521_2025_RED/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-48.032,22.091,-47.863,22.461],17],["ESP_058005_1845_RED_spline_rect","MRO HiRISE, Mosaic Insight Landing Site","mosaic","~/tiles/Mars/EQ/ESP_058005_1845_RED_spline_rect/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[135.569,4.33,135.696,4.668],17],["spirit_hirise_mosaic","MRO HiRISE, Spirit Roving Site Mosaic","mosaic","~/tiles/Mars/EQ/spirit_hirise_mosaic/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[175.428,-14.693,175.586,-14.536],17],["mars_pahrump_patch_8k_256m","MSL, Pahrump Hills","mosaic","~/tiles/Mars/EQ/mars_pahrump_patch_8k_256m/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[137.375,-4.665,137.38,-4.661],18],["HRSC_Martian_east","Mars Express HRSC, Martian Path Eastern Section Color Mosaic","region","~/tiles/Mars/EQ/HRSC_Martian_east/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-.268,-4.007,16.697,4.107],11],["MC11E_HRMOSCO_COL","Mars Express HRSC, Martian Path MC11 Quad Color Mosaic","region","~/tiles/Mars/EQ/MC11E_HRMOSCO_COL/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-22.5,0,0,30.001],9],["hrsc_mawrth_vallis_color","Mars Express HRSC, Mawrth Vallis Color Mosaic","region","~/tiles/Mars/EQ/hrsc_mawrth_vallis_color/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-22,21,-16.5,27],10],["h2942_0000_nd3","Mars Express HRSC, Viking 1 Landing Site Mosaic","region","~/tiles/Mars/EQ/h2942_0000_nd3/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-49.592,14.068,-46.398,26.812],10],["h1394_0000_nd3","Mars Express HRSC, Viking 2 Landing Site Mosaic","region","~/tiles/Mars/EQ/h1394_0000_nd3/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[73.089,46.049,174.821,87.065],9],["SIM3292_Global_Geology","Global Geology","overlay","~/mars/trekarcgis/rest/services/SIM3292_Global_Geology/MapServer/WMTS/tile/1.0.0/SIM3292_Global_Geology/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,90],11],["T1303_FeMgSmectite_Mineral_Indicator_SP","MRO CRISM Fe-Mg Smectite Indicator, CRISM tile 1303","overlay","~/mars/trekarcgis/rest/services/T1303_FeMgSmectite_Mineral_Indicator_SP/MapServer/WMTS/tile/1.0.0/T1303_FeMgSmectite_Mineral_Indicator_SP/default/default/{z}/{r}/{c}.png",256,[-20.502,16.998,-14.499,23.003],11],["MC18_PolySulfate_Mineral_IndicatorV2_SP","MRO CRISM Polyhydrated Sulfate Indicator, USGS Mars Chart 18","overlay","~/mars/trekarcgis/rest/services/MC18_PolySulfate_Mineral_IndicatorV2_SP/MapServer/WMTS/tile/1.0.0/MC18_PolySulfate_Mineral_IndicatorV2_SP/default/default/{z}/{r}/{c}.png",256,[-95.504,-32.999,-39.498,3.004],11],["Hynek_Valley_Networks","Valley Networks","overlay","~/mars/trekarcgis/rest/services/Hynek_Valley_Networks/MapServer/WMTS/tile/1.0.0/Hynek_Valley_Networks/default/default028mm/{z}/{r}/{c}.png",256,[-180,-71.68,179.964,53.777],8]],SM=[["Apollo17_MetricCam_Mosaic_Global_3033ppd","Apollo 17 Metric Cam Image Mosaic","base","~/tiles/Moon/EQ/Apollo17_MetricCam_Mosaic_Global_3033ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-31,180,32],10],["ApolloZone_MetricCam_Mosaic_Global_3033ppd","Apollo Zone Metric Cam Image Mosaic","base","~/tiles/Moon/EQ/ApolloZone_MetricCam_Mosaic_Global_3033ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-31,180,32],10],["ApolloZone_MetricCam_Shade_Global_1024ppd","Apollo Zone Metric Cam, Hillshade","base","~/tiles/Moon/EQ/ApolloZone_MetricCam_Shade_Global_1024ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-38,180,34],8],["Clem_UVVIS_Mosaic_Global_256ppd_v02","Clementine UVVIS Image Mosaic","base","~/tiles/Moon/EQ/Clem_UVVIS_Mosaic_Global_256ppd_v02/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,90],6],["Kaguya_TCortho_Mosaic_Global_4096ppd","Kaguya TC Ortho Mosaic","base","~/tiles/Moon/EQ/Kaguya_TCortho_Mosaic_Global_4096ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,90],10],["ClemLO_Mosaic_Global_512ppd_v02","LO HR/MR Cam and Clementine UVVIS Hybrid Image Mosaic","base","~/tiles/Moon/EQ/ClemLO_Mosaic_Global_512ppd_v02/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,90],7],["LO_HRMR_Mosaic_Global_512ppd","LO HR/MR Cam Image Mosaic","base","~/tiles/Moon/EQ/LO_HRMR_Mosaic_Global_512ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,90],7],["LRO_DIVINER_ClrRockFreeSurfaceTemp_Global_128ppd","LRO DLRE Surface Temperature Mosaic 128ppd, Colorized","base","~/tiles/Moon/EQ/LRO_DIVINER_ClrRockFreeSurfaceTemp_Global_128ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-70,180,70],6],["ldam_10","LRO Laser Altimeter, Albedo Global","base","~/tiles/Moon/EQ/ldam_10/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,90],3],["LRO_LOLAKaguya_ClrHillshade_60N60S_512ppd","LRO LOLA and Kaguya TC Color Hillshade 512ppd, Global","base","~/tiles/Moon/EQ/LRO_LOLAKaguya_ClrHillshade_60N60S_512ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-60,180,60],10],["LRO_LOLAKaguya_Hillshade_60N60S_512ppd","LRO LOLA and Kaguya TC Hillshade 512ppd, Global","base","~/tiles/Moon/EQ/LRO_LOLAKaguya_Hillshade_60N60S_512ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-60,180,60],10],["LRO_LOLA_ClrHillshade_128ppd_Site007","LRO LOLA Color Hillshade 128ppd, Endurance-A Concept Site 007","base","~/tiles/Moon/EQ/LRO_LOLA_ClrHillshade_128ppd_Site007/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-89.565,180,-87.696],3],["LRO_LOLA_Hillshade_128ppd_Site007","LRO LOLA Hillshade 128ppd, Endurance-A Concept Site 007","base","~/tiles/Moon/EQ/LRO_LOLA_Hillshade_128ppd_Site007/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,-86.753],4],["LRO_NAC_AvgMosaic_NPole855_1mp_EQ","LRO LROC NAC Image Mosaic, N Pole, Avg Merge","base","~/tiles/Moon/EQ/LRO_NAC_AvgMosaic_NPole855_1mp_EQ/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,83.639,180,90],12],["LRO_NAC_AvgMosaic_SPole855_1mp_EQ","LRO LROC NAC Image Mosaic, S Pole, Avg Merge","base","~/tiles/Moon/EQ/LRO_NAC_AvgMosaic_SPole855_1mp_EQ/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,-83.639],12],["LRO_MiniRF_CPR_Gray_Global_128ppd","LRO Mini-RF Circular Polarization Ratio, Grayscale","base","~/tiles/Moon/EQ/LRO_MiniRF_CPR_Gray_Global_128ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,90],5],["LRO_MiniRF_S1_Gray_Global_128ppd","LRO Mini-RF First Stokes Parameter","base","~/tiles/Moon/EQ/LRO_MiniRF_S1_Gray_Global_128ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,90],5],["NAC_POLE_PSR_NORTH_STRETCH_EQ","LRO NAC PSR Mosaic 20mpp, N Pole","base","~/tiles/Moon/EQ/NAC_POLE_PSR_NORTH_STRETCH_EQ/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,75.511,180,90],8],["NAC_POLE_PSR_SOUTH_STRETCH_EQ","LRO NAC PSR Mosaic 20mpp, S Pole","base","~/tiles/Moon/EQ/NAC_POLE_PSR_SOUTH_STRETCH_EQ/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,-75.51],8],["CE2_GRAS_DOM_07m","CE-2 CCD Ortho Mosaic","mosaic","~/tiles/Moon/EQ/CE2_GRAS_DOM_07m/1.0.0/default/default028mm/{z}/{r}/{c}.jpg",256,[-180,-90,180,83.284],11],["schrodinger.sc.equirect","LRO Narrow Angle Camera, Mosaic Schrodinger SouthCenter","mosaic","~/tiles/Moon/EQ/schrodinger.sc.equirect/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[133.18,-79.337,147.622,-76.919],12],["schrodinger.extraswaths.eq","LRO Narrow Angle Camera, Mosaic Schrodinger Extra","mosaic","~/tiles/Moon/EQ/schrodinger.extraswaths.eq/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[132.393,-81.023,146.094,-74.764],13],["LRO_NAC_Schrodinger","LRO Narrow Angle Camera, Mosaic Schrodinger","mosaic","~/tiles/Moon/EQ/LRO_NAC_Schrodinger/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[137.029,-78.267,143.918,-73.922],13],["schrodinger.ne.equirect","LRO Narrow Angle Camera, Mosaic Schrodinger NorthEast","mosaic","~/tiles/Moon/EQ/schrodinger.ne.equirect/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[135.756,-77.121,142.777,-73.904],13],["LRO_NAC_SchrodingerLandingSite2","LRO Narrow Angle Camera, Mosaic Schrodinger Landing Site","mosaic","~/tiles/Moon/EQ/LRO_NAC_SchrodingerLandingSite2/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[137.931,-80.043,143.575,-76.569],13],["Philolaus_skylight","LRO Narrow Angle Camera, Mosaic Philolaus","mosaic","~/tiles/Moon/EQ/Philolaus_skylight/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-34.624,70.494,-29.261,73.43],13],["schrodinger.se.equirect","LRO Narrow Angle Camera, Mosaic Schrodinger SouthEast","mosaic","~/tiles/Moon/EQ/schrodinger.se.equirect/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[143.135,-81.068,147.905,-78.98],13],["Apollo15_PanCam_Mosaic_25N311E_150cmp","Apollo 15 Pan Cam Image Mosaic, Aristarchus Plateau 1","mosaic","~/tiles/Moon/EQ/Apollo15_PanCam_Mosaic_25N311E_150cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-49.77,23.437,-48.036,26.094],13],["LRO_NAC_Mosaic_0_67mpp_Malapert_Massif","LRO NAC Mosaic 0.67mpp, Malapert Massif","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_0_67mpp_Malapert_Massif/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-5.251,-86.054,4.776,-85.634],13],["Apollo15_PanCam_Mosaic_28N307E_1mp","Apollo 15 Pan Cam Image Mosaic, Aristarchus Plateau 2","mosaic","~/tiles/Moon/EQ/Apollo15_PanCam_Mosaic_28N307E_1mp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-53.104,26.683,-51.536,29.097],13],["LRO_NAC_Post_Landing_OrthoMosaic_1mpp_IM_1_LandingSite","LRO NAC Post-Landing Ortho Mosaic 1mpp, IM-1 Landing Site","mosaic","~/tiles/Moon/EQ/LRO_NAC_Post_Landing_OrthoMosaic_1mpp_IM_1_LandingSite/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[.939,-80.216,1.939,-80.043],13],["LRO_NAC_Pre_Landing_OrthoMosaic_1mpp_IM_1_LandingSite","LRO NAC Pre-Landing Ortho Mosaic 1mpp, IM-1 Landing Site","mosaic","~/tiles/Moon/EQ/LRO_NAC_Pre_Landing_OrthoMosaic_1mpp_IM_1_LandingSite/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[.939,-80.216,1.939,-80.043],13],["LRO_NAC_Ortho_1_52mpp_SiteD","LRO NAC Orthoimage 1.52mpp, Endurance-A Concept Site D","mosaic","~/tiles/Moon/EQ/LRO_NAC_Ortho_1_52mpp_SiteD/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-171.992,-57.267,-171.87,-57.201],13],["SchrodingerCraterMareUnit_50cmV1.0.eq","LROC NAC Uncontrolled Mosaic of Mare Unit in Schrodinger Crater","mosaic","~/tiles/Moon/EQ/SchrodingerCraterMareUnit_50cmV1.0.eq/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[127.113,-76.216,137.303,-71.91],14],["SchrodingerCraterMassif_50cmV1.0.eq","LROC NAC Uncontrolled Mosaic of Massif in Schrodinger Crater","mosaic","~/tiles/Moon/EQ/SchrodingerCraterMassif_50cmV1.0.eq/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[121.75,-76.85,132.3,-74.35],14],["SchrodingerMareNorth.eq","LROC NAC Uncontrolled Mosaic of Region Inside Schrodinger Crater, 50cm/px","mosaic","~/tiles/Moon/EQ/SchrodingerMareNorth.eq/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[132.772,-74.221,137.107,-71.969],14],["20200415_lacusmortis_orthomos_filled_8bit_lzw","LRO NAC Mosaic, Lacus Mortis, Extended Version","mosaic","~/tiles/Moon/EQ/20200415_lacusmortis_orthomos_filled_8bit_lzw/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[24.576,43.287,26.055,45.989],14],["LRO_NAC_ortho_picardV1","LRO NAC Mosaic, Picard in Mare Crisium","mosaic","~/tiles/Moon/EQ/LRO_NAC_ortho_picardV1/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[54.336,11.541,55.272,15.633],14],["20191118-imagemos_smoothtrans_32bit_latlon_lzw","LRO NAC Image Mosaic, Lacus Mortis","mosaic","~/tiles/Moon/EQ/20191118-imagemos_smoothtrans_32bit_latlon_lzw/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[24.576,43.439,26.055,45.989],14],["LRO_NAC_Mosaic_61N099E_50cmp","LRO LROC Image Mosaic, Compton Belkovich Th Anomaly","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_61N099E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[98.114,60.435,100.837,61.755],14],["NAC_DTM_APOLLO17_MOSAIC_120CM","LRO Narrow Angle Camera, Mosaic Apollo 17","mosaic","~/tiles/Moon/EQ/NAC_DTM_APOLLO17_MOSAIC_120CM/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[29.906,19.391,31.658,21.304],14],["LRO_NAC_Mosaic_43S349E_50cmp","LRO LROC Image Mosaic, Tycho Crater","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_43S349E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-12.105,-43.643,-10.301,-42.323],14],["LRO_NAC_Mosaic_28N307E_50cmp","LRO LROC Image Mosaic, Aristarchus 2","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_28N307E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-53.292,27.208,-51.797,28.528],14],["LRO_NAC_Mosaic_27N318E_50cmp","LRO LROC Image Mosaic, Rimae Prinz","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_27N318E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-42.454,26.738,-40.973,28.058],14],["LRO_NAC_Mosaic_26N004E_50cmp","LRO LROC Image Mosaic, Apollo 15","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_26N004E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[2.931,25.446,4.399,26.766],14],["LRO_NAC_Mosaic_19S129E_50cmp","LRO LROC Image Mosaic, Tsiolkovskiy Crater","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_19S129E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[127.827,-20.024,129.223,-18.704],14],["LRO_NAC_Mosaic_19S070E_50cmp","LRO LROC Image Mosaic, Balmer Basin","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_19S070E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[69.135,-19.364,70.531,-18.044],14],["LRO_NAC_Mosaic_17S173E_50cmp","LRO LROC Image Mosaic, Aitken Crater","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_17S173E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[172.777,-17.444,174.156,-16.125],14],["LRO_NAC_Mosaic_16S041E_50cmp","LRO LROC Image Mosaic, Montes Pyrenaeus","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_16S041E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[40.138,-16.581,41.511,-15.261],14],["LRO_NAC_Mosaic_13N356E_50cmp","LRO LROC Image Mosaic, Rima Bode","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_13N356E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-4.432,12.224,-3.077,13.544],14],["LRO_NAC_Mosaic_07N022E_50cmp","LRO LROC Image Mosaic, Mare Tranquillitatis","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_07N022E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[21.41,6.252,22.739,7.571],14],["LRO_NAC_Mosaic_05N000E_50cmp","LRO LROC Image Mosaic, Murchison Crater","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_05N000E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-1.074,4.053,.25,5.372],14],["LRO_NAC_Mosaic_02N085E_50cmp","LRO LROC Image Mosaic, Mare Smythii","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_02N085E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[84.68,1.483,86.001,2.803],14],["LRO_NAC_Mosaic_03S286E_50cmp","LRO LROC Image Mosaic, Riccioli Crater","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_03S286E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-74.926,-3.714,-73.605,-2.394],14],["LRO_NAC_Mosaic_02S167E_50cmp","LRO LROC Image Mosaic, Stratton (Dewar)","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_02S167E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[166.105,-2.74,167.425,-1.42],14],["LRO_NAC_Mosaic_02S317E_50cmp","LRO LROC Image Mosaic, Flamsteed Crater","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_02S317E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-43.858,-3.127,-42.538,-1.807],14],["LRO_NAC_Mosaic_00N234E_50cmp","LRO LROC Image Mosaic, Hertzsprung","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_00N234E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-126.247,-.574,-124.927,.746],14],["LRO_NAC_Mosaic_32N292E_50cmp","LRO LROC Image Mosaic, Lichtenberg Crater","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_32N292E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-67.879,31.004,-66.854,32.316],14],["LRO_NAC_Mosaic_36S164E_70cmp","LRO LROC Image Mosaic, Mare Ingenii","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_36S164E_70cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[164.023,-36.136,164.864,-34.858],14],["LRO_NAC_Mosaic_26S265E_50cmp","LRO LROC Image Mosaic, Orientale 1","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_26S265E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-95.788,-26.717,-95.062,-25.491],14],["LRO_NAC_Mosaic_36N320E_50cmp","LRO LROC Image Mosaic, Gruithuisen Domes","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_36N320E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-40.334,35.668,-39.643,36.743],14],["LRO_NAC_Mosaic_03N280E_70cm","LRO LROC Mosaic, Fresh Crater East of Lents","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_03N280E_70cm/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-100.562,2.666,-100.032,4.043],14],["LRO_NAC_Mosaic_25N311E_50cmp","LRO LROC Image Mosaic, Aristarchus 1","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_25N311E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-49.041,24.089,-48.435,25.29],14],["LRO_NAC_Mosaic_26N150E_50cmp","LRO LROC Image Mosaic, Mare Moscoviense","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_26N150E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[150.146,25.623,150.685,26.817],14],["LRO_NAC_Mosaic_13S358E_50cmp","LRO LROC Image Mosaic, Alphonsus","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_13S358E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-2.608,-13.12,-2.005,-12.087],14],["LRO_NAC_Mosaic_08N332E_50cmp","LRO LROC Image Mosaic, Hortensius Domes","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_08N332E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-28.074,7.062,-27.476,8.092],14],["LRO_NAC_Mosaic_06N120E_50cmp","LRO LROC Image Mosaic, King Crater","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_06N120E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[119.558,5.984,120.101,7.109],14],["LRO_NAC_Mosaic_55N077E_50cmp","LRO LROC Image Mosaic, Humboldtianum Basin","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_55N077E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[76.903,53.778,77.397,54.935],14],["LRO_NAC_Mosaic_14N304E_50cmp","LRO LROC Image Mosaic, Marius Hills","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_14N304E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-56.136,13.213,-55.642,14.196],14],["LRO_NAC_Mosaic_07N301E_50cmp","LRO LROC Image Mosaic, Reiner Gamma","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_07N301E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-58.866,6.859,-58.41,7.823],14],["LRO_NAC_Mosaic_20N010E_60cmp","LRO LROC Image Mosaic, Sulpicius Gallus","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_20N010E_60cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[10.2,19.549,10.571,20.518],14],["LRO_NAC_Mosaic_19N005E_50cmp","LRO LROC Image Mosaic, Ina D-Caldera","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_19N005E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[5.229,18.129,5.505,19.086],14],["LRO_NAC_Ortho_0_66mpp_SiteQ","LRO NAC Orthoimage 0.66mpp, Endurance-A Concept Site Q","mosaic","~/tiles/Moon/EQ/LRO_NAC_Ortho_0_66mpp_SiteQ/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[138.818,-75.152,139.828,-74.891],14],["LRO_NAC_Ortho_0_78mpp_SiteB","LRO NAC Orthoimage 0.78mpp, Endurance-A Site B","mosaic","~/tiles/Moon/EQ/LRO_NAC_Ortho_0_78mpp_SiteB/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[162.433,-57.629,162.736,-56.854],14],["LRO_NAC_Ortho_0_79mpp_SiteC","LRO NAC Orthoimage 0.79mpp, Endurance-A Concept Site C","mosaic","~/tiles/Moon/EQ/LRO_NAC_Ortho_0_79mpp_SiteC/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[176.492,-61.293,176.63,-61.227],14],["LRO_NAC_Ortho_0_82mpp_SiteA","LRO NAC Orthoimage 0.82mpp, Endurance-A Concept Site A","mosaic","~/tiles/Moon/EQ/LRO_NAC_Ortho_0_82mpp_SiteA/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[160.986,-59.158,161.116,-59.091],14],["LRO_NAC_Ortho_1_25mpp_SiteH","LRO NAC Orthoimage 1.25mpp, Endurance-A Concept Site H","mosaic","~/tiles/Moon/EQ/LRO_NAC_Ortho_1_25mpp_SiteH/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-161.864,-57.895,-161.74,-57.829],14],["LRO_NAC_Ortho_0_82mpp_SiteG","LRO NAC Orthoimage 0.82mpp, Endurance-A Concept Site G","mosaic","~/tiles/Moon/EQ/LRO_NAC_Ortho_0_82mpp_SiteG/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-162.648,-57.232,-162.525,-57.166],14],["LRO_NAC_Mosaic_50cmpp_VonKarman_v2","LRO NAC Mosaic 0.5mpp, Von Karman","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_50cmpp_VonKarman_v2/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[171.449,-48.929,179.924,-42.019],15],["LRO_NAC_Mosaic_0_52mpp_SiteH","LRO NAC Mosaic 0.52mpp, Site H","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_0_52mpp_SiteH/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-161.033,-60.509,-158.058,-58.913],15],["LRO_NAC_Ortho_0_52mpp_SiteH","LRO NAC Mosaic 0.52mpp, Endurance-A (Near) Site H","mosaic","~/tiles/Moon/EQ/LRO_NAC_Ortho_0_52mpp_SiteH/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-161.033,-60.509,-158.058,-58.913],15],["A15_60x60km.0_2.eq","LRO Narrow Angle Camera, Mosaic Apollo 15","mosaic","~/tiles/Moon/EQ/A15_60x60km.0_2.eq/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[2.641,25.141,4.619,27.119],15],["A16_60x60km.eq","LRO Narrow Angle Camera, Mosaic Apollo 16","mosaic","~/tiles/Moon/EQ/A16_60x60km.eq/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[14.511,-9.959,16.489,-7.981],15],["A17_60x60km.eq","LRO Narrow Angle Camera, Mosaic Apollo 17","mosaic","~/tiles/Moon/EQ/A17_60x60km.eq/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[29.781,19.201,31.759,21.179],15],["A14_60x60km.0_3.eq","LRO Narrow Angle Camera, Mosaic Apollo 14","mosaic","~/tiles/Moon/EQ/A14_60x60km.0_3.eq/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-18.459,-4.639,-16.481,-2.661],15],["A12_60x60km.0_3.eq","LRO Narrow Angle Camera, Mosaic Apollo 12","mosaic","~/tiles/Moon/EQ/A12_60x60km.0_3.eq/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-24.409,-3.999,-22.431,-2.021],15],["A11_60x60km.eq","LRO Narrow Angle Camera, Mosaic Apollo 11","mosaic","~/tiles/Moon/EQ/A11_60x60km.eq/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[22.481,-.319,24.459,1.659],15],["LRO_NAC_ortho_horseshoeV2","LRO NAC Mosaic, Horseshoe in Mare Crisium","mosaic","~/tiles/Moon/EQ/LRO_NAC_ortho_horseshoeV2/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[61.392,16.608,62.227,20.091],15],["LRO_NAC_Mosaic_09S015E_50cmp","LRO LROC Image Mosaic, Apollo 16","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_09S015E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[14.818,-9.651,16.154,-8.331],15],["LRO_NAC_Mosaic_0_82mpp_Shioli","LRO NAC Mosaic 0.82mpp, Shioli","mosaic","~/tiles/Moon/EQ/LRO_NAC_Mosaic_0_82mpp_Shioli/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[25.06,-14.173,25.844,-12.587],15],["ingenii_skylight","LRO Narrow Angle Camera, Mosaic Ingenii","mosaic","~/tiles/Moon/EQ/ingenii_skylight/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[165.907,-36.666,166.148,-35.697],15],["small_tranq_skylight_2","LRO Narrow Angle Camera, Mosaic Small Tranquilltatis 2","mosaic","~/tiles/Moon/EQ/small_tranq_skylight_2/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[20.714,-.348,20.891,.596],15],["marius_skylight","LRO Narrow Angle Camera, Mosaic Marius","mosaic","~/tiles/Moon/EQ/marius_skylight/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-56.827,13.449,-56.665,14.397],15],["apollo14_28cm_mosaic_byte_geo_1_2_highContrast","LRO LROC Image Mosaic 28cm, Apollo 14","mosaic","~/tiles/Moon/EQ/apollo14_28cm_mosaic_byte_geo_1_2_highContrast/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-17.49,-4.192,-17.391,-3.225],15],["apollo11_26cm_mosaic_byte_geo_1_2_highContrast","LRO LROC Image Mosaic 26cm, Apollo 11","mosaic","~/tiles/Moon/EQ/apollo11_26cm_mosaic_byte_geo_1_2_highContrast/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[23.448,.146,23.54,1.115],15],["small_tranq_skylight_1","LRO Narrow Angle Camera, Mosaic Small Tranquilltatis 1","mosaic","~/tiles/Moon/EQ/small_tranq_skylight_1/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[28.401,4.689,28.547,5.288],15],["M129086118.nd.gcs","LRO Narrow Angle Camera, Mosaic Apollo 17 Landing Site","mosaic","~/tiles/Moon/EQ/M129086118.nd.gcs/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[30.686,20.029,30.844,20.366],15],["Apollo15_MetricCam_Mosaic_Global_4096ppd","Apollo 15 Metric Cam Image Mosaic","region","~/tiles/Moon/EQ/Apollo15_MetricCam_Mosaic_Global_4096ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-68,-30,180,34],11],["Apollo15_PanCam_Mosaic_19S129E_2mp","Apollo 15 Pan Cam Image Mosaic, Tsiolkovskiy Crater","region","~/tiles/Moon/EQ/Apollo15_PanCam_Mosaic_19S129E_2mp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[127.393,-21.051,129.756,-18.288],12],["Apollo16_MetricCam_Mosaic_Global_4096ppd","Apollo 16 Metric Cam Image Mosaic","region","~/tiles/Moon/EQ/Apollo16_MetricCam_Mosaic_Global_4096ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-48,-14,180,14],10],["TC2W2B0_01_07463S484E3342__TC1W2B0_01_07463S490E3341_ba_aligned_DRG","Kaguya TC Ortho Image 9mpp, 07463S484E3342_07463S490E3341","region","~/tiles/Moon/EQ/TC2W2B0_01_07463S484E3342__TC1W2B0_01_07463S490E3341_ba_aligned_DRG/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-26.218,-49.205,-25.464,-48.263],11],["LRO_LOLA_ClrHillshade_128ppd_SiteA","LRO LOLA Color Hillshade 128ppd, Endurance-A Concept Site A","region","~/tiles/Moon/EQ/LRO_LOLA_ClrHillshade_128ppd_SiteA/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[159.405,-59.955,162.701,-58.29],6],["LRO_LOLA_ClrHillshade_128ppd_SiteC","LRO LOLA Color Hillshade 128ppd, Endurance-A Concept Site C","region","~/tiles/Moon/EQ/LRO_LOLA_ClrHillshade_128ppd_SiteC/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[174.8,-62.089,178.324,-60.425],6],["LRO_LOLA_ClrHillshade_128ppd_SiteD","LRO LOLA Color Hillshade 128ppd, Endurance-A Concept Site D","region","~/tiles/Moon/EQ/LRO_LOLA_ClrHillshade_128ppd_SiteD/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-173.489,-58.062,-170.369,-56.401],6],["LRO_LOLA_ClrHillshade_128ppd_SiteE","LRO LOLA Color Hillshade 128ppd, Endurance-A Concept Site E","region","~/tiles/Moon/EQ/LRO_LOLA_ClrHillshade_128ppd_SiteE/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-172.315,-56.259,-169.321,-54.584],6],["LRO_LOLA_ClrHillshade_128ppd_SiteF","LRO LOLA Color Hillshade 128ppd, Endurance-A Concept Site F","region","~/tiles/Moon/EQ/LRO_LOLA_ClrHillshade_128ppd_SiteF/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-168.184,-57.425,-165.113,-55.768],6],["LRO_LOLA_ClrHillshade_128ppd_SiteG","LRO LOLA Color Hillshade 128ppd, Endurance-A Concept Site G","region","~/tiles/Moon/EQ/LRO_LOLA_ClrHillshade_128ppd_SiteG/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-164.355,-58.187,-161.219,-56.522],6],["LRO_LOLA_ClrHillshade_128ppd_SiteH","LRO LOLA Color Hillshade 128ppd, Endurance-A Concept Site H","region","~/tiles/Moon/EQ/LRO_LOLA_ClrHillshade_128ppd_SiteH/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-163.388,-58.694,-160.208,-57.028],6],["LRO_LOLA_ClrHillshade_128ppd_SiteO","LRO LOLA Color Hillshade 128ppd, Endurance-A Concept Site O","region","~/tiles/Moon/EQ/LRO_LOLA_ClrHillshade_128ppd_SiteO/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[156.014,-67.415,168.852,-62.351],6],["LRO_LOLA_ClrHillshade_128ppd_SiteP","LRO LOLA Color Hillshade 128ppd, Endurance-A Concept Site P","region","~/tiles/Moon/EQ/LRO_LOLA_ClrHillshade_128ppd_SiteP/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[132.337,-74.24,138.411,-72.56],6],["LRO_LOLA_ClrHillshade_128ppd_SiteQ","LRO LOLA Color Hillshade 128ppd, Endurance-A Concept Site Q","region","~/tiles/Moon/EQ/LRO_LOLA_ClrHillshade_128ppd_SiteQ/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[135.956,-75.852,142.695,-74.175],5],["LRO_LOLA_ClrHillshade_128ppd_SiteB","LRO LOLA Color Hillshade 128ppd, Endurance-A Site B","region","~/tiles/Moon/EQ/LRO_LOLA_ClrHillshade_128ppd_SiteB/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[162.01,-57.564,163.245,-56.884],6],["LRO_LOLA_Hillshade_128ppd_SiteA","LRO LOLA Hillshade 128ppd, Endurance-A Concept Site A","region","~/tiles/Moon/EQ/LRO_LOLA_Hillshade_128ppd_SiteA/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[159.318,-59.969,162.803,-58.271],6],["LRO_LOLA_Hillshade_128ppd_SiteC","LRO LOLA Hillshade 128ppd, Endurance-A Concept Site C","region","~/tiles/Moon/EQ/LRO_LOLA_Hillshade_128ppd_SiteC/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[174.696,-62.106,178.438,-60.406],6],["LRO_LOLA_Hillshade_128ppd_SiteD","LRO LOLA Hillshade 128ppd, Endurance-A Concept Site D","region","~/tiles/Moon/EQ/LRO_LOLA_Hillshade_128ppd_SiteD/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-173.563,-58.079,-170.281,-56.384],6],["LRO_LOLA_Hillshade_128ppd_SiteE","LRO LOLA Hillshade 128ppd, Endurance-A Concept Site E","region","~/tiles/Moon/EQ/LRO_LOLA_Hillshade_128ppd_SiteE/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-172.385,-56.278,-169.252,-54.575],6],["LRO_LOLA_Hillshade_128ppd_SiteF","LRO LOLA Hillshade 128ppd, Endurance-A Concept Site F","region","~/tiles/Moon/EQ/LRO_LOLA_Hillshade_128ppd_SiteF/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-168.262,-57.446,-165.037,-55.748],6],["LRO_LOLA_Hillshade_128ppd_SiteG","LRO LOLA Hillshade 128ppd, Endurance-A Concept Site G","region","~/tiles/Moon/EQ/LRO_LOLA_Hillshade_128ppd_SiteG/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-164.428,-58.197,-161.148,-56.509],6],["LRO_LOLA_Hillshade_128ppd_SiteH","LRO LOLA Hillshade 128ppd, Endurance-A Concept Site H","region","~/tiles/Moon/EQ/LRO_LOLA_Hillshade_128ppd_SiteH/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-163.473,-58.709,-160.114,-57.013],6],["LRO_LOLA_Hillshade_128ppd_SiteO","LRO LOLA Hillshade 128ppd, Endurance-A Concept Site O","region","~/tiles/Moon/EQ/LRO_LOLA_Hillshade_128ppd_SiteO/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[154.687,-67.542,170.224,-62.189],6],["LRO_LOLA_Hillshade_128ppd_SiteP","LRO LOLA Hillshade 128ppd, Endurance-A Concept Site P","region","~/tiles/Moon/EQ/LRO_LOLA_Hillshade_128ppd_SiteP/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[131.987,-74.26,138.746,-72.525],6],["LRO_LOLA_Hillshade_128ppd_SiteQ","LRO LOLA Hillshade 128ppd, Endurance-A Concept Site Q","region","~/tiles/Moon/EQ/LRO_LOLA_Hillshade_128ppd_SiteQ/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[135.551,-75.891,143.099,-74.139],5],["LRO_LOLA_Hillshade_128ppd_SiteB","LRO LOLA Hillshade 128ppd, Endurance-A Site B","region","~/tiles/Moon/EQ/LRO_LOLA_Hillshade_128ppd_SiteB/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[162.01,-57.564,163.245,-56.884],6],["LRO_LOLA_NAC_ColorHillshade_3_5mpp_IM_1_LandingSite","LRO LOLA NAC Color Hillshade 3.5mpp, IM-1 Landing Site","region","~/tiles/Moon/EQ/LRO_LOLA_NAC_ColorHillshade_3_5mpp_IM_1_LandingSite/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[.937,-80.217,1.942,-80.042],11],["LRO_NAC_Mosaic_60S200E_50cmp","LRO LROC Image Mosaic, South Pole-Aitken Basin Interior","region","~/tiles/Moon/EQ/LRO_NAC_Mosaic_60S200E_50cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-161.213,-60.623,-158.574,-59.303],14],["LRO_NAC_Mosaic_51S171E_60cmp","LRO LROC Image Mosaic, South Pole-Aitken Rim","region","~/tiles/Moon/EQ/LRO_NAC_Mosaic_51S171E_60cmp/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[170.503,-51.668,171.401,-50.371],14],["Large_Tranquilltatis_mosaic","LRO LROC Image, Large Tranquillitatis","region","~/tiles/Moon/EQ/Large_Tranquilltatis_mosaic/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[33.167,8.117,33.309,9.069],15],["UCL-Aristarchus-ORI-JPL-AOI-10m","LRO NAC and CE-2 CCD Ortho Mosaic, Aristarchus Crater","region","~/tiles/Moon/EQ/UCL-Aristarchus-ORI-JPL-AOI-10m/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-48.035,23.059,-46.579,24.445],11],["LRO_NAC_ClrHillshade_2_4mpp_SiteC","LRO NAC Color Hillshade 2.4mpp, Endurance-A Concept Site C","region","~/tiles/Moon/EQ/LRO_NAC_ClrHillshade_2_4mpp_SiteC/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[176.492,-61.293,176.629,-61.227],14],["LRO_NAC_ClrHillshade_2_5mpp_SiteA","LRO NAC Color Hillshade 2.5mpp, Endurance-A Concept Site A","region","~/tiles/Moon/EQ/LRO_NAC_ClrHillshade_2_5mpp_SiteA/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[160.987,-59.157,161.115,-59.091],13],["LRO_NAC_ClrHillshade_2_5mpp_SiteG","LRO NAC Color Hillshade 2.5mpp, Endurance-A Concept Site G","region","~/tiles/Moon/EQ/LRO_NAC_ClrHillshade_2_5mpp_SiteG/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-162.648,-57.232,-162.526,-57.166],13],["LRO_NAC_ClrHillshade_2_5mpp_SiteB","LRO NAC Color Hillshade 2.5mpp, Endurance-A Site B","region","~/tiles/Moon/EQ/LRO_NAC_ClrHillshade_2_5mpp_SiteB/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[162.433,-57.629,162.737,-56.854],13],["LRO_NAC_ClrHillshade_2_5mpp_Shioli","LRO NAC Color Hillshade 2.5mpp, Shioli","region","~/tiles/Moon/EQ/LRO_NAC_ClrHillshade_2_5mpp_Shioli/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[25.06,-14.173,25.847,-12.587],13],["LRO_NAC_ClrHillshade_2mpp_SiteQ","LRO NAC Color Hillshade 2mpp, Endurance-A Concept Site Q","region","~/tiles/Moon/EQ/LRO_NAC_ClrHillshade_2mpp_SiteQ/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[139.196,-75.054,139.452,-74.988],12],["LRO_NAC_ColorHillshade_3_5mpp_IM_1_LandingSite","LRO NAC Color Hillshade 3.5mpp, IM-1 Landing Site","region","~/tiles/Moon/EQ/LRO_NAC_ColorHillshade_3_5mpp_IM_1_LandingSite/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[.914,-80.221,1.966,-80.038],11],["LRO_NAC_ClrHillshade_3_75mpp_SiteH","LRO NAC Color Hillshade 3.75mpp, Endurance-A Concept Site H","region","~/tiles/Moon/EQ/LRO_NAC_ClrHillshade_3_75mpp_SiteH/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-161.864,-57.895,-161.74,-57.829],12],["LRO_NAC_ClrHillshade_4_57mpp_SiteD","LRO NAC Color Hillshade 4.57mpp, Endurance-A Concept Site D","region","~/tiles/Moon/EQ/LRO_NAC_ClrHillshade_4_57mpp_SiteD/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-171.992,-57.267,-171.87,-57.201],12],["20191118-demmos-eqc-colorhillshade","LRO NAC ColorHillshade, Lacus Mortis","region","~/tiles/Moon/EQ/20191118-demmos-eqc-colorhillshade/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[24.577,43.441,26.053,45.987],13],["LRO_NAC_CraterDetections_0_83mpp_SiteQ","LRO NAC Crater Detections 0.83mpp, Endurance-A Concept Site Q","region","~/tiles/Moon/EQ/LRO_NAC_CraterDetections_0_83mpp_SiteQ/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[139.196,-75.054,139.452,-74.988],14],["LRO_NAC_Hillshade_2_4mpp_SiteC","LRO NAC Hillshade 2.4mpp, Endurance-A Concept Site C","region","~/tiles/Moon/EQ/LRO_NAC_Hillshade_2_4mpp_SiteC/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[176.492,-61.293,176.629,-61.227],14],["LRO_NAC_Hillshade_2_5mpp_SiteA","LRO NAC Hillshade 2.5mpp, Endurance-A Concept Site A","region","~/tiles/Moon/EQ/LRO_NAC_Hillshade_2_5mpp_SiteA/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[160.987,-59.157,161.115,-59.091],13],["LRO_NAC_Hillshade_2_5mpp_SiteG","LRO NAC Hillshade 2.5mpp, Endurance-A Concept Site G","region","~/tiles/Moon/EQ/LRO_NAC_Hillshade_2_5mpp_SiteG/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-162.648,-57.232,-162.526,-57.166],13],["LRO_NAC_Hillshade_2_5mpp_SiteB","LRO NAC Hillshade 2.5mpp, Endurance-A Site B","region","~/tiles/Moon/EQ/LRO_NAC_Hillshade_2_5mpp_SiteB/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[162.433,-57.629,162.737,-56.854],13],["LRO_NAC_Hillshade_2_5mpp_Shioli","LRO NAC Hillshade 2.5mpp, Shioli","region","~/tiles/Moon/EQ/LRO_NAC_Hillshade_2_5mpp_Shioli/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[25.06,-14.173,25.847,-12.587],13],["LRO_NAC_Hillshade_2mpp_SiteQ","LRO NAC Hillshade 2mpp, Endurance-A Concept Site Q","region","~/tiles/Moon/EQ/LRO_NAC_Hillshade_2mpp_SiteQ/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[139.195,-75.054,139.452,-74.988],12],["LRO_NAC_Hillshade_3_75mpp_SiteH","LRO NAC Hillshade 3.75mpp, Endurance-A Concept Site H","region","~/tiles/Moon/EQ/LRO_NAC_Hillshade_3_75mpp_SiteH/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-161.864,-57.895,-161.74,-57.829],12],["LRO_NAC_Hillshade_4_57mpp_SiteD","LRO NAC Hillshade 4.57mpp, Endurance-A Concept Site D","region","~/tiles/Moon/EQ/LRO_NAC_Hillshade_4_57mpp_SiteD/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-171.992,-57.267,-171.87,-57.201],12],["LRO_NAC_Post_Landing_Image_1mpp_IM_1_Lander","LRO NAC Post-Landing Image 1mpp, IM-1 Lander","region","~/tiles/Moon/EQ/LRO_NAC_Post_Landing_Image_1mpp_IM_1_Lander/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[1.313,-80.15,1.571,-80.105],13],["LRO_NAC_Apollo11_Mosaic_p","LRO Narrow Angle Camera, Apollo 11 Landing Site","region","~/tiles/Moon/EQ/LRO_NAC_Apollo11_Mosaic_p/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[23.448,.146,23.54,1.115],15],["LRO_NAC_Apollo12_Mosaic_p","LRO Narrow Angle Camera, Apollo 12 Landing Site","region","~/tiles/Moon/EQ/LRO_NAC_Apollo12_Mosaic_p/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-23.445,-3.472,-23.357,-2.502],16],["LRO_NAC_Apollo14_Mosaic_p","LRO Narrow Angle Camera, Apollo 14 Landing Site","region","~/tiles/Moon/EQ/LRO_NAC_Apollo14_Mosaic_p/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-17.49,-4.192,-17.391,-3.225],15],["LRO_NAC_Apollo15_Mosaic_p","LRO Narrow Angle Camera, Apollo 15 Landing Site","region","~/tiles/Moon/EQ/LRO_NAC_Apollo15_Mosaic_p/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[3.581,25.796,3.689,26.763],16],["LRO_NAC_Apollo16_Mosaic_p","LRO Narrow Angle Camera, Apollo 16 Landing Site","region","~/tiles/Moon/EQ/LRO_NAC_Apollo16_Mosaic_p/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[15.379,-9.606,15.555,-8.662],14],["NAC_DTM_APOLLO17_CLRSHADE","LRO Narrow Angle Camera, ColorHillShade Apollo 17","region","~/tiles/Moon/EQ/NAC_DTM_APOLLO17_CLRSHADE/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[29.906,19.391,31.658,21.304],12],["NAC_DTM_APOLLO17_SHADE","LRO Narrow Angle Camera, HillShade Apollo 17","region","~/tiles/Moon/EQ/NAC_DTM_APOLLO17_SHADE/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[29.906,19.391,31.658,21.304],12],["allSchrodinger_10mV1.0.eq","LROC NAC Uncontrolled Mosaic of Schrodinger Crater, 10m/px","region","~/tiles/Moon/EQ/allSchrodinger_10mV1.0.eq/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[110,-82,160,-68],10],["Clem_UVVIS_FeO_Clr_Global_152ppd","Clementine UVVIS FeO Weight Percent","overlay","~/tiles/Moon/EQ/Clem_UVVIS_FeO_Clr_Global_152ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,179.997,90],6],["Clem_UVVIS_OpticalMaturity_Gray_Global_152ppd","Clementine UVVIS Optical Maturity","overlay","~/tiles/Moon/EQ/Clem_UVVIS_OpticalMaturity_Gray_Global_152ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,179.997,90.002],6],["Clem_UVVIS_TiO2_Clr_Global_152ppd","Clementine UVVIS TiO2 Weight Percent","overlay","~/tiles/Moon/EQ/Clem_UVVIS_TiO2_Clr_Global_152ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,179.997,90],6],["Lunar_Clementine_UVVIS_Warp_ClrRatio_Global_200m","Clementine UVVIS Warped Color Ratio","overlay","~/tiles/Moon/EQ/Lunar_Clementine_UVVIS_Warp_ClrRatio_Global_200m/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-89.671,179.997,89.672],7],["SPA_GeoMap_lqbal_et_al","Geologic Map of South Pole-Aitken (SPA) Basin and South Pole Region of the Moon","overlay","~/tiles/Moon/EQ/SPA_GeoMap_lqbal_et_al/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,9.767],8],["Lunar_Kaguya_MIMap_MineralDeconv_ClinopyroxenePercent_50N50S","Kaguya MI Clinopyroxene Weight Percent","overlay","~/tiles/Moon/EQ/Lunar_Kaguya_MIMap_MineralDeconv_ClinopyroxenePercent_50N50S/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-50,180,50],1],["Lunar_Kaguya_MIMap_MineralDeconv_FeOWeightPercent_50N50S_colorize","Kaguya MI Colorized FeO Weight Percent","overlay","~/tiles/Moon/EQ/Lunar_Kaguya_MIMap_MineralDeconv_FeOWeightPercent_50N50S_colorize/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-50,180,50],1],["Lunar_Kaguya_MIMap_MineralDeconv_OlivinePercent_50N50S_colorize","Kaguya MI Colorized Olivine Weight Percent","overlay","~/tiles/Moon/EQ/Lunar_Kaguya_MIMap_MineralDeconv_OlivinePercent_50N50S_colorize/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-50,180,50],1],["Lunar_Kaguya_MIMap_MineralDeconv_OrthopyroxenePercent_50N50S_colorize","Kaguya MI Colorized Orthopyroxene Weight Percent","overlay","~/tiles/Moon/EQ/Lunar_Kaguya_MIMap_MineralDeconv_OrthopyroxenePercent_50N50S_colorize/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-50,180,50],1],["Lunar_Kaguya_MIMap_MineralDeconv_PlagioclasePercent_50N50S_colorize","Kaguya MI Colorized Plagioclase Weight Percent","overlay","~/tiles/Moon/EQ/Lunar_Kaguya_MIMap_MineralDeconv_PlagioclasePercent_50N50S_colorize/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-50,180,50],1],["Lunar_Kaguya_MIMap_MineralDeconv_FeOWeightPercent_50N50S","Kaguya MI FeO Weight Percent","overlay","~/tiles/Moon/EQ/Lunar_Kaguya_MIMap_MineralDeconv_FeOWeightPercent_50N50S/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-50,180,50],1],["Lunar_Kaguya_MIMap_MineralDeconv_OpticalMaturityIndex_50N50S_grayscale","Kaguya MI Grayscale Optical Maturity","overlay","~/tiles/Moon/EQ/Lunar_Kaguya_MIMap_MineralDeconv_OpticalMaturityIndex_50N50S_grayscale/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-50,180,50],1],["Lunar_Kaguya_MIMap_MineralDeconv_PlagioclaseGrainSizeMicrons_50N50S_grayscale","Kaguya MI Grayscale Plagioclase Grain Size","overlay","~/tiles/Moon/EQ/Lunar_Kaguya_MIMap_MineralDeconv_PlagioclaseGrainSizeMicrons_50N50S_grayscale/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-50,180,50],1],["Lunar_Kaguya_MIMap_MineralDeconv_AbundanceSMFe_50N50S_grayscale","Kaguya MI Grayscale SMFe Abundance","overlay","~/tiles/Moon/EQ/Lunar_Kaguya_MIMap_MineralDeconv_AbundanceSMFe_50N50S_grayscale/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-50,180,50],1],["Lunar_Kaguya_MIMap_MineralDeconv_WeightedCriteriaValue_50N50S_grayscale","Kaguya MI Grayscale Weighted Criteria Value ","overlay","~/tiles/Moon/EQ/Lunar_Kaguya_MIMap_MineralDeconv_WeightedCriteriaValue_50N50S_grayscale/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-50,180,50],1],["Lunar_Kaguya_MIMap_MineralDeconv_OlivinePercent_50N50S","Kaguya MI Olivine Weight Percent","overlay","~/tiles/Moon/EQ/Lunar_Kaguya_MIMap_MineralDeconv_OlivinePercent_50N50S/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-50,180,50],1],["Lunar_Kaguya_MIMap_MineralDeconv_OpticalMaturityIndex_50N50S","Kaguya MI Optical Maturity","overlay","~/tiles/Moon/EQ/Lunar_Kaguya_MIMap_MineralDeconv_OpticalMaturityIndex_50N50S/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-50,180,50],1],["Lunar_Kaguya_MIMap_MineralDeconv_OrthopyroxenePercent_50N50S","Kaguya MI Orthopyroxene Weight Percent","overlay","~/tiles/Moon/EQ/Lunar_Kaguya_MIMap_MineralDeconv_OrthopyroxenePercent_50N50S/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-50,180,50],1],["Lunar_Kaguya_MIMap_MineralDeconv_PlagioclaseGrainSizeMicrons_50N50S","Kaguya MI Plagioclase Grain Size","overlay","~/tiles/Moon/EQ/Lunar_Kaguya_MIMap_MineralDeconv_PlagioclaseGrainSizeMicrons_50N50S/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-50,180,50],1],["Lunar_Kaguya_MIMap_MineralDeconv_PlagioclasePercent_50N50S","Kaguya MI Plagioclase Weight Percent","overlay","~/tiles/Moon/EQ/Lunar_Kaguya_MIMap_MineralDeconv_PlagioclasePercent_50N50S/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-50,180,50],1],["Lunar_Kaguya_MIMap_MineralDeconv_AbundanceSMFe_50N50S","Kaguya MI SMFe Abundance","overlay","~/tiles/Moon/EQ/Lunar_Kaguya_MIMap_MineralDeconv_AbundanceSMFe_50N50S/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-50,180,50],1],["Lunar_Kaguya_MIMap_MineralDeconv_WeightedCriteriaValue_50N50S","Kaguya MI Weighted Criteria Value","overlay","~/tiles/Moon/EQ/Lunar_Kaguya_MIMap_MineralDeconv_WeightedCriteriaValue_50N50S/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-50,180,50],1],["Unified_Geologic_Map_of_the_Moon_RASTER","Kaguya TC Geologic Map","overlay","~/tiles/Moon/EQ/Unified_Geologic_Map_of_the_Moon_RASTER/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,90],5],["LRO_LOLA_ClrSlope_Global_16ppd","LOLA Slope 16ppd, Colorized","overlay","~/tiles/Moon/EQ/LRO_LOLA_ClrSlope_Global_16ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,90],2],["LRO_LOLA_ClrSlope_NPole75N_120m_EQ","LOLA Slope Northpole 120m, Colorized","overlay","~/tiles/Moon/EQ/LRO_LOLA_ClrSlope_NPole75N_120m_EQ/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,68.912,179.999,90],6],["LRO_LOLA_ClrSlope_SPole75S_120m_EQ","LOLA Slope Southpole 120m, Colorized","overlay","~/tiles/Moon/EQ/LRO_LOLA_ClrSlope_SPole75S_120m_EQ/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-89.995,179.999,-68.907],6],["LP_GRS_ClrTitaniumAbundance_2ppd","LP GRS Color Ti Abundance 2ppd, Global","overlay","~/tiles/Moon/EQ/LP_GRS_ClrTitaniumAbundance_2ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,90],0],["LP_GRS_Fe_Clr_Global_2ppd","LP GRS Fe Abundance","overlay","~/tiles/Moon/EQ/LP_GRS_Fe_Clr_Global_2ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,90],0],["LP_GRS_K_Clr_Global_halfppd","LP GRS K Abundance","overlay","~/tiles/Moon/EQ/LP_GRS_K_Clr_Global_halfppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,90],1],["LP_GRS_Th_Clr_Global_2ppd","LP GRS Th Abundance","overlay","~/tiles/Moon/EQ/LP_GRS_Th_Clr_Global_2ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,90],1],["LP_GRS_TitaniumAbundance_2ppd","LP GRS Ti Abundance 2ppd, Global","overlay","~/tiles/Moon/EQ/LP_GRS_TitaniumAbundance_2ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,90],0],["LP_NS_H_Clr_Global_2ppd","LP NS H Abundance","overlay","~/tiles/Moon/EQ/LP_NS_H_Clr_Global_2ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-90,180,90],1],["LRO_LOLAKaguya_ClrSlope_60N60S_512ppd","LRO LOLA and Kaguya TC Color Slope 512ppd, Global","overlay","~/tiles/Moon/EQ/LRO_LOLAKaguya_ClrSlope_60N60S_512ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-60,180,60],10],["LRO_LOLAKaguya_Slope_60N60S_512ppd","LRO LOLA and Kaguya TC Slope 512ppd, Global","overlay","~/tiles/Moon/EQ/LRO_LOLAKaguya_Slope_60N60S_512ppd/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-180,-60,180,60],10],["LRO_NAC_ClrCraterSlopes_1mpp_SiteH","LRO NAC Color Crater Slopes 1mmp, Site H","overlay","~/tiles/Moon/EQ/LRO_NAC_ClrCraterSlopes_1mpp_SiteH/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-160.323,-60.23,-158.823,-59.197],14],["LRO_NAC_ClrCraterSlopes_2mpp_SiteQ","LRO NAC Color Crater Slopes 2mpp, Site Q","overlay","~/tiles/Moon/EQ/LRO_NAC_ClrCraterSlopes_2mpp_SiteQ/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[139.069,-75.087,139.578,-74.955],11],["LRO_NAC_ClrCraterSlopesMasked_1mpp_SiteH","LRO NAC Color Crater Slopes Masked 1mmp, Site H","overlay","~/tiles/Moon/EQ/LRO_NAC_ClrCraterSlopesMasked_1mpp_SiteH/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-160.323,-60.23,-158.823,-59.197],14],["LRO_NAC_ClrCraterSlopesMasked_2mpp_SiteQ","LRO NAC Color Crater Slopes Masked 2mpp, Site Q","overlay","~/tiles/Moon/EQ/LRO_NAC_ClrCraterSlopesMasked_2mpp_SiteQ/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[139.069,-75.087,139.578,-74.955],11],["LRO_NAC_ClrSlope_2_5mpp_Shioli","LRO NAC Color Slope 2.5mpp, Shioli","overlay","~/tiles/Moon/EQ/LRO_NAC_ClrSlope_2_5mpp_Shioli/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[25.058,-14.173,25.845,-12.587],13],["LRO_NAC_CraterSlopes_1mpp_SiteH","LRO NAC Crater Slopes 1mmp, Site H","overlay","~/tiles/Moon/EQ/LRO_NAC_CraterSlopes_1mpp_SiteH/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-159.724,-60.184,-159.444,-59.243],14],["LRO_NAC_CraterSlopes_2mpp_SiteQ","LRO NAC Crater Slopes 2mpp, Site Q","overlay","~/tiles/Moon/EQ/LRO_NAC_CraterSlopes_2mpp_SiteQ/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[139.196,-75.054,139.452,-74.988],12],["LRO_NAC_CraterSlopesMasked_1mpp_SiteH","LRO NAC Crater Slopes Masked 1mmp, Site H","overlay","~/tiles/Moon/EQ/LRO_NAC_CraterSlopesMasked_1mpp_SiteH/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[-159.724,-60.184,-159.444,-59.243],14],["LRO_NAC_CraterSlopesMasked_2mpp_SiteQ","LRO NAC Crater Slopes Masked 2mpp, Site Q","overlay","~/tiles/Moon/EQ/LRO_NAC_CraterSlopesMasked_2mpp_SiteQ/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[139.196,-75.054,139.452,-74.988],12],["LRO_NAC_Slope_2_5mpp_Shioli","LRO NAC Slope 2.5mpp, Shioli","overlay","~/tiles/Moon/EQ/LRO_NAC_Slope_2_5mpp_Shioli/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[25.061,-14.173,25.843,-12.587],13],["NAC_DTM_APOLLO17_SLOPE","LRO Narrow Angle Camera, Slope Apollo 17","overlay","~/tiles/Moon/EQ/NAC_DTM_APOLLO17_SLOPE/1.0.0/default/default028mm/{z}/{r}/{c}.png",256,[29.906,19.391,31.658,21.304],12]],ks=(r,e,t,n,i,s="jpg")=>({id:e,label:t,credit:n,px:256,maxZ:i,url:(a,o,l)=>`https://trek.nasa.gov/tiles/${r}/EQ/${e}/1.0.0/default/default028mm/${a}/${o}/${l}.${s}`}),eu=ks("Mars","Mars_Viking_MDIM21_ClrMosaic_global_232m","Farbmosaik (Viking, 232 m)","NASA/USGS Viking MDIM 2.1 · NASA Mars Trek",7),tu={id:"ctx",label:"Kontextkamera (CTX, ≈ 5 m)",credit:"NASA/JPL/MSSS/Caltech Murray Lab · Esri",px:512,maxZ:12,tint:14923676,skipLevels:[7],url:(r,e,t)=>`https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/${r}/${e}/${t}`},Ju=(r,e)=>r.map(([t,n,i,s,a,o,l])=>{const c=s.replace(/^~\//,"https://trek.nasa.gov/"),u=c.includes("arcgis.com");return{id:t,title:n,group:i,bbox:o,layer:{id:t,label:n,credit:u?e.esri:e.trek,px:a,maxZ:l,url:(h,d,f)=>c.replace("{z}",String(h)).replace("{r}",String(d)).replace("{c}",String(f))}}}),vM=Ju(xM,{trek:"NASA/JPL/USGS/ASU/ESA/University of Arizona · NASA Mars Trek",esri:"NASA/JPL/University of Arizona (HiRISE) · Esri"}),EM=Ju(SM,{trek:"NASA/GSFC/ASU/JAXA/USGS · NASA Moon Trek",esri:"NASA/GSFC/ASU LROC · Esri"}),nu=ks("Moon","LRO_WAC_Mosaic_Global_303ppd_v02","LRO-Mosaik (WAC, ≈ 100 m)","NASA/GSFC/ASU LRO WAC · NASA Moon Trek",7),Ia=ks("Mercury","Mercury_MESSENGER_MDIS_Basemap_BDR_Mosaic_Global_166m","MESSENGER-Mosaik (166 m)","NASA/JHUAPL/CIW MESSENGER MDIS · NASA Mercury Trek",7),yM=ks("Mercury","Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m","Farbkontrast (665 m)","NASA/JHUAPL/CIW MESSENGER MDIS · NASA Mercury Trek",6),iu={earth:{id:"earth",name:"Erde",radiusKm:6371,enabled:!0,openAt:1.45,layers:[],detail3d:()=>eu,baseLevel:99},mars:{id:"mars",name:"Mars",radiusKm:3389.5,enabled:!0,openAt:1.1,layers:[tu],detail3d:r=>r<=6?eu:tu,baseLevel:4,autoLabel:"Automatisch (Farbe → 5 m → HiRISE)",globalLabel:"Farbmosaik (Viking, 232 m)",products:vM},moon:{id:"moon",name:"Mond",radiusKm:1737.4,enabled:!0,openAt:1.03,layers:[nu],detail3d:()=>nu,baseLevel:4,autoLabel:"Automatisch (WAC → LROC-NAC)",products:EM},mercury:{id:"mercury",name:"Merkur",radiusKm:2439.7,enabled:!1,openAt:1.1,layers:[Ia,yM],detail3d:()=>Ia,baseLevel:4},venus:{id:"venus",name:"Venus",radiusKm:6051.8,enabled:!1,openAt:1.1,layers:[],detail3d:()=>Ia,baseLevel:4}},ix=r=>!!iu[r]?.enabled&&iu[r].layers.length>0;export{kM as $,ZM as A,Nr as B,NM as C,ff as D,Gs as E,iu as F,_n as G,nx as H,Ih as I,Pt as J,Lt as K,Bh as L,AM as M,Cu as N,ut as O,di as P,vn as Q,Ir as R,IM as S,TM as T,PM as U,I as V,OM as W,ex as X,Kc as Y,aM as Z,GM as _,Ie as a,FM as a0,Jo as a1,Ru as a2,BM as a3,No as a4,yr as a5,tx as a6,kh as a7,HM as a8,Xc as a9,jM as aa,zM as ab,$M as ac,Yu as ad,UM as ae,DM as af,Vn as ag,QM as ah,YM as ai,Pr as aj,Pu as ak,Zu as al,sM as am,WM as an,KM as ao,Fu as ap,Ne as aq,il as ar,lh as b,RM as c,Ps as d,zt as e,df as f,wt as g,LM as h,uM as i,JM as j,XM as k,dt as l,ix as m,kt as n,Uu as o,wM as p,mc as q,VM as r,qM as s,Iu as t,Dn as u,Or as v,nn as w,CM as x,Th as y,_l as z};
