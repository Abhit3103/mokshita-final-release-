[1mdiff --git a/package-lock.json b/package-lock.json[m
[1mindex 8048002..996517e 100644[m
[1m--- a/package-lock.json[m
[1m+++ b/package-lock.json[m
[36m@@ -10,14 +10,13 @@[m
       "license": "ISC",[m
       "dependencies": {[m
         "@supabase/supabase-js": "^2.108.2",[m
[31m-        "bcryptjs": "^2.4.3",[m
         "cors": "^2.8.5",[m
         "dotenv": "^16.4.5",[m
         "express": "^4.19.2",[m
         "express-rate-limit": "^7.3.1",[m
         "express-validator": "^7.1.0",[m
         "helmet": "^7.1.0",[m
[31m-        "jsonwebtoken": "^9.0.2",[m
[32m+[m[32m        "jose": "^6.2.4",[m
         "morgan": "^1.10.0",[m
         "multer": "^2.1.1",[m
         "pg": "^8.12.0",[m
[36m@@ -25,12 +24,36 @@[m
         "uuid": "^11.1.1"[m
       },[m
       "devDependencies": {[m
[31m-        "nodemon": "^3.1.4"[m
[32m+[m[32m        "nodemon": "^3.1.4",[m
[32m+[m[32m        "supertest": "^7.2.2"[m
       },[m
       "engines": {[m
         "node": ">=18.0.0"[m
       }[m
     },[m
[32m+[m[32m    "node_modules/@noble/hashes": {[m
[32m+[m[32m      "version": "1.8.0",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/@noble/hashes/-/hashes-1.8.0.tgz",[m
[32m+[m[32m      "integrity": "sha512-jCs9ldd7NwzpgXDIf6P3+NrHh9/sD6CQdxHyjQI+h/6rDNo88ypBxxz45UDuZHz9r3tNz7N/VInSVoVdtXEI4A==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "MIT",[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": "^14.21.3 || >=16"[m
[32m+[m[32m      },[m
[32m+[m[32m      "funding": {[m
[32m+[m[32m        "url": "https://paulmillr.com/funding/"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
[32m+[m[32m    "node_modules/@paralleldrive/cuid2": {[m
[32m+[m[32m      "version": "2.3.1",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/@paralleldrive/cuid2/-/cuid2-2.3.1.tgz",[m
[32m+[m[32m      "integrity": "sha512-XO7cAxhnTZl0Yggq6jOgjiOHhbgcO4NqFqwSmQpjK3b6TEE6Uj/jfSk6wzYyemh3+I0sHirKSetjQwn5cZktFw==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "MIT",[m
[32m+[m[32m      "dependencies": {[m
[32m+[m[32m        "@noble/hashes": "^1.1.5"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
     "node_modules/@supabase/auth-js": {[m
       "version": "2.108.2",[m
       "resolved": "https://registry.npmjs.org/@supabase/auth-js/-/auth-js-2.108.2.tgz",[m
[36m@@ -189,6 +212,13 @@[m
       "integrity": "sha512-PCVAQswWemu6UdxsDFFX/+gVeYqKAod3D3UVm91jHwynguOwAvYPhx8nNlM++NqRcK6CxxpUafjmhIdKiHibqg==",[m
       "license": "MIT"[m
     },[m
[32m+[m[32m    "node_modules/asap": {[m
[32m+[m[32m      "version": "2.0.6",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/asap/-/asap-2.0.6.tgz",[m
[32m+[m[32m      "integrity": "sha512-BSHWgDSAiKs50o2Re8ppvp3seVHXSRM44cdSsT9FfNEUUZLOGWVCsiWaRPWM1Znn+mqZ1OfVZ3z3DWEzSp7hRA==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "MIT"[m
[32m+[m[32m    },[m
     "node_modules/asynckit": {[m
       "version": "0.4.0",[m
       "resolved": "https://registry.npmjs.org/asynckit/-/asynckit-0.4.0.tgz",[m
[36m@@ -235,12 +265,6 @@[m
       "integrity": "sha512-Gd2UZBJDkXlY7GbJxfsE8/nvKkUEU1G38c1siN6QP6a9PT9MmHB8GnpscSmMJSoF8LOIrt8ud/wPtojys4G6+g==",[m
       "license": "MIT"[m
     },[m
[31m-    "node_modules/bcryptjs": {[m
[31m-      "version": "2.4.3",[m
[31m-      "resolved": "https://registry.npmjs.org/bcryptjs/-/bcryptjs-2.4.3.tgz",[m
[31m-      "integrity": "sha512-V/Hy/X9Vt7f3BbPJEi8BdVFMByHi+jNXrYkW3huaybV/kQ0KJg0Y6PkEMbn+zeT+i+SiKZ/HMqJGIIt4LZDqNQ==",[m
[31m-      "license": "MIT"[m
[31m-    },[m
     "node_modules/binary-extensions": {[m
       "version": "2.3.0",[m
       "resolved": "https://registry.npmjs.org/binary-extensions/-/binary-extensions-2.3.0.tgz",[m
[36m@@ -319,12 +343,6 @@[m
         "node": ">=8"[m
       }[m
     },[m
[31m-    "node_modules/buffer-equal-constant-time": {[m
[31m-      "version": "1.0.1",[m
[31m-      "resolved": "https://registry.npmjs.org/buffer-equal-constant-time/-/buffer-equal-constant-time-1.0.1.tgz",[m
[31m-      "integrity": "sha512-zRpUiDwd/xk6ADqPMATG8vc9VPrkck7T07OIx0gnjmJAnHnTVXNQG3vfvWNuiZIkwu9KrKdA1iJKfsfTVxE6NA==",[m
[31m-      "license": "BSD-3-Clause"[m
[31m-    },[m
     "node_modules/buffer-from": {[m
       "version": "1.1.2",[m
       "resolved": "https://registry.npmjs.org/buffer-from/-/buffer-from-1.1.2.tgz",[m
[36m@@ -417,6 +435,16 @@[m
         "node": ">= 0.8"[m
       }[m
     },[m
[32m+[m[32m    "node_modules/component-emitter": {[m
[32m+[m[32m      "version": "1.3.1",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/component-emitter/-/component-emitter-1.3.1.tgz",[m
[32m+[m[32m      "integrity": "sha512-T0+barUSQRTUQASh8bx02dl+DhF54GtIDY13Y3m9oWTklKbb3Wv974meRpeZ3lp1JpLVECWWNHC4vaG2XHXouQ==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "MIT",[m
[32m+[m[32m      "funding": {[m
[32m+[m[32m        "url": "https://github.com/sponsors/sindresorhus"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
     "node_modules/concat-stream": {[m
       "version": "2.0.0",[m
       "resolved": "https://registry.npmjs.org/concat-stream/-/concat-stream-2.0.0.tgz",[m
[36m@@ -468,6 +496,13 @@[m
       "integrity": "sha512-NXdYc3dLr47pBkpUCHtKSwIOQXLVn8dZEuywboCOJY/osA0wFSLlSawr3KN8qXJEyX66FcONTH8EIlVuK0yyFA==",[m
       "license": "MIT"[m
     },[m
[32m+[m[32m    "node_modules/cookiejar": {[m
[32m+[m[32m      "version": "2.1.4",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/cookiejar/-/cookiejar-2.1.4.tgz",[m
[32m+[m[32m      "integrity": "sha512-LDx6oHrK+PhzLKJU9j5S7/Y3jM/mUHvD/DeI1WQmJn652iPC5Y4TBzC9l+5OMOXlyTTA+SmVUPm0HQUwpD5Jqw==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "MIT"[m
[32m+[m[32m    },[m
     "node_modules/cors": {[m
       "version": "2.8.6",[m
       "resolved": "https://registry.npmjs.org/cors/-/cors-2.8.6.tgz",[m
[36m@@ -522,6 +557,17 @@[m
         "npm": "1.2.8000 || >= 1.4.16"[m
       }[m
     },[m
[32m+[m[32m    "node_modules/dezalgo": {[m
[32m+[m[32m      "version": "1.0.4",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/dezalgo/-/dezalgo-1.0.4.tgz",[m
[32m+[m[32m      "integrity": "sha512-rXSP0bf+5n0Qonsb+SVVfNfIsimO4HEtmnIpPHY8Q1UCzKlQrDMfdobr8nJOOsRgWCyMRqeSBQzmWUMq7zvVig==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "ISC",[m
[32m+[m[32m      "dependencies": {[m
[32m+[m[32m        "asap": "^2.0.0",[m
[32m+[m[32m        "wrappy": "1"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
     "node_modules/dotenv": {[m
       "version": "16.6.1",[m
       "resolved": "https://registry.npmjs.org/dotenv/-/dotenv-16.6.1.tgz",[m
[36m@@ -548,15 +594,6 @@[m
         "node": ">= 0.4"[m
       }[m
     },[m
[31m-    "node_modules/ecdsa-sig-formatter": {[m
[31m-      "version": "1.0.11",[m
[31m-      "resolved": "https://registry.npmjs.org/ecdsa-sig-formatter/-/ecdsa-sig-formatter-1.0.11.tgz",[m
[31m-      "integrity": "sha512-nagl3RYrbNv6kQkeJIpt6NJZy8twLB/2vtz6yN9Z4vRKHN4/QZJIEbqohALSgwKdnksuY3k5Addp5lg8sVoVcQ==",[m
[31m-      "license": "Apache-2.0",[m
[31m-      "dependencies": {[m
[31m-        "safe-buffer": "^5.0.1"[m
[31m-      }[m
[31m-    },[m
     "node_modules/ee-first": {[m
       "version": "1.1.1",[m
       "resolved": "https://registry.npmjs.org/ee-first/-/ee-first-1.1.1.tgz",[m
[36m@@ -706,6 +743,13 @@[m
         "node": ">= 8.0.0"[m
       }[m
     },[m
[32m+[m[32m    "node_modules/fast-safe-stringify": {[m
[32m+[m[32m      "version": "2.1.1",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/fast-safe-stringify/-/fast-safe-stringify-2.1.1.tgz",[m
[32m+[m[32m      "integrity": "sha512-W+KJc2dmILlPplD/H4K9l9LcAHAfPtP6BY84uVLXQ6Evcz9Lcg33Y2z1IVblT6xdY54PXYVHEv+0Wpq8Io6zkA==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "MIT"[m
[32m+[m[32m    },[m
     "node_modules/fill-range": {[m
       "version": "7.1.1",[m
       "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz",[m
[36m@@ -773,6 +817,24 @@[m
         "node": ">= 6"[m
       }[m
     },[m
[32m+[m[32m    "node_modules/formidable": {[m
[32m+[m[32m      "version": "3.5.4",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/formidable/-/formidable-3.5.4.tgz",[m
[32m+[m[32m      "integrity": "sha512-YikH+7CUTOtP44ZTnUhR7Ic2UASBPOqmaRkRKxRbywPTe5VxF7RRCck4af9wutiZ/QKM5nME9Bie2fFaPz5Gug==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "MIT",[m
[32m+[m[32m      "dependencies": {[m
[32m+[m[32m        "@paralleldrive/cuid2": "^2.2.2",[m
[32m+[m[32m        "dezalgo": "^1.0.4",[m
[32m+[m[32m        "once": "^1.4.0"[m
[32m+[m[32m      },[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": ">=14.0.0"[m
[32m+[m[32m      },[m
[32m+[m[32m      "funding": {[m
[32m+[m[32m        "url": "https://ko-fi.com/tunnckoCore/commissions"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
     "node_modules/forwarded": {[m
       "version": "0.2.0",[m
       "resolved": "https://registry.npmjs.org/forwarded/-/forwarded-0.2.0.tgz",[m
[36m@@ -1080,53 +1142,13 @@[m
         "node": ">=0.12.0"[m
       }[m
     },[m
[31m-    "node_modules/jsonwebtoken": {[m
[31m-      "version": "9.0.3",[m
[31m-      "resolved": "https://registry.npmjs.org/jsonwebtoken/-/jsonwebtoken-9.0.3.tgz",[m
[31m-      "integrity": "sha512-MT/xP0CrubFRNLNKvxJ2BYfy53Zkm++5bX9dtuPbqAeQpTVe0MQTFhao8+Cp//EmJp244xt6Drw/GVEGCUj40g==",[m
[32m+[m[32m    "node_modules/jose": {[m
[32m+[m[32m      "version": "6.2.4",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/jose/-/jose-6.2.4.tgz",[m
[32m+[m[32m      "integrity": "sha512-N8acGzVsQy6M/fjFcxtysNc4Q379TcM5dM/qKkNtsHFji88yANnXTr7BLeP75iPnFwBfQzM/jg2BZ9+HZrHCZA==",[m
       "license": "MIT",[m
[31m-      "dependencies": {[m
[31m-        "jws": "^4.0.1",[m
[31m-        "lodash.includes": "^4.3.0",[m
[31m-        "lodash.isboolean": "^3.0.3",[m
[31m-        "lodash.isinteger": "^4.0.4",[m
[31m-        "lodash.isnumber": "^3.0.3",[m
[31m-        "lodash.isplainobject": "^4.0.6",[m
[31m-        "lodash.isstring": "^4.0.1",[m
[31m-        "lodash.once": "^4.0.0",[m
[31m-        "ms": "^2.1.1",[m
[31m-        "semver": "^7.5.4"[m
[31m-      },[m
[31m-      "engines": {[m
[31m-        "node": ">=12",[m
[31m-        "npm": ">=6"[m
[31m-      }[m
[31m-    },[m
[31m-    "node_modules/jsonwebtoken/node_modules/ms": {[m
[31m-      "version": "2.1.3",[m
[31m-      "resolved": "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",[m
[31m-      "integrity": "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==",[m
[31m-      "license": "MIT"[m
[31m-    },[m
[31m-    "node_modules/jwa": {[m
[31m-      "version": "2.0.1",[m
[31m-      "resolved": "https://registry.npmjs.org/jwa/-/jwa-2.0.1.tgz",[m
[31m-      "integrity": "sha512-hRF04fqJIP8Abbkq5NKGN0Bbr3JxlQ+qhZufXVr0DvujKy93ZCbXZMHDL4EOtodSbCWxOqR8MS1tXA5hwqCXDg==",[m
[31m-      "license": "MIT",[m
[31m-      "dependencies": {[m
[31m-        "buffer-equal-constant-time": "^1.0.1",[m
[31m-        "ecdsa-sig-formatter": "1.0.11",[m
[31m-        "safe-buffer": "^5.0.1"[m
[31m-      }[m
[31m-    },[m
[31m-    "node_modules/jws": {[m
[31m-      "version": "4.0.1",[m
[31m-      "resolved": "https://registry.npmjs.org/jws/-/jws-4.0.1.tgz",[m
[31m-      "integrity": "sha512-EKI/M/yqPncGUUh44xz0PxSidXFr/+r0pA70+gIYhjv+et7yxM+s29Y+VGDkovRofQem0fs7Uvf4+YmAdyRduA==",[m
[31m-      "license": "MIT",[m
[31m-      "dependencies": {[m
[31m-        "jwa": "^2.0.1",[m
[31m-        "safe-buffer": "^5.0.1"[m
[32m+[m[32m      "funding": {[m
[32m+[m[32m        "url": "https://github.com/sponsors/panva"[m
       }[m
     },[m
     "node_modules/lodash": {[m
[36m@@ -1135,48 +1157,6 @@[m
       "integrity": "sha512-dMInicTPVE8d1e5otfwmmjlxkZoUpiVLwyeTdUsi/Caj/gfzzblBcCE5sRHV/AsjuCmxWrte2TNGSYuCeCq+0Q==",[m
       "license": "MIT"[m
     },[m
[31m-    "node_modules/lodash.includes": {[m
[31m-      "version": "4.3.0",[m
[31m-      "resolved": "https://registry.npmjs.org/lodash.includes/-/lodash.includes-4.3.0.tgz",[m
[31m-      "integrity": "sha512-W3Bx6mdkRTGtlJISOvVD/lbqjTlPPUDTMnlXZFnVwi9NKJ6tiAk6LVdlhZMm17VZisqhKcgzpO5Wz91PCt5b0w==",[m
[31m-      "license": "MIT"[m
[31m-    },[m
[31m-    "node_modules/lodash.isboolean": {[m
[31m-      "version": "3.0.3",[m
[31m-      "resolved": "https://registry.npmjs.org/lodash.isboolean/-/lodash.isboolean-3.0.3.tgz",[m
[31m-      "integrity": "sha512-Bz5mupy2SVbPHURB98VAcw+aHh4vRV5IPNhILUCsOzRmsTmSQ17jIuqopAentWoehktxGd9e/hbIXq980/1QJg==",[m
[31m-      "license": "MIT"[m
[31m-    },[m
[31m-    "node_modules/lodash.isinteger": {[m
[31m-      "version": "4.0.4",[m
[31m-      "resolved": "https://registry.npmjs.org/lodash.isinteger/-/lodash.isinteger-4.0.4.tgz",[m
[31m-      "integrity": "sha512-DBwtEWN2caHQ9/imiNeEA5ys1JoRtRfY3d7V9wkqtbycnAmTvRRmbHKDV4a0EYc678/dia0jrte4tjYwVBaZUA==",[m
[31m-      "license": "MIT"[m
[31m-    },[m
[31m-    "node_modules/lodash.isnumber": {[m
[31m-      "version": "3.0.3",[m
[31m-      "resolved": "https://registry.npmjs.org/lodash.isnumber/-/lodash.isnumber-3.0.3.tgz",[m
[31m-      "integrity": "sha512-QYqzpfwO3/CWf3XP+Z+tkQsfaLL/EnUlXWVkIk5FUPc4sBdTehEqZONuyRt2P67PXAk+NXmTBcc97zw9t1FQrw==",[m
[31m-      "license": "MIT"[m
[31m-    },[m
[31m-    "node_modules/lodash.isplainobject": {[m
[31m-      "version": "4.0.6",[m
[31m-      "resolved": "https://registry.npmjs.org/lodash.isplainobject/-/lodash.isplainobject-4.0.6.tgz",[m
[31m-      "integrity": "sha512-oSXzaWypCMHkPC3NvBEaPHf0KsA5mvPrOPgQWDsbg8n7orZ290M0BmC/jgRZ4vcJ6DTAhjrsSYgdsW/F+MFOBA==",[m
[31m-      "license": "MIT"[m
[31m-    },[m
[31m-    "node_modules/lodash.isstring": {[m
[31m-      "version": "4.0.1",[m
[31m-      "resolved": "https://registry.npmjs.org/lodash.isstring/-/lodash.isstring-4.0.1.tgz",[m
[31m-      "integrity": "sha512-0wJxfxH1wgO3GrbuP+dTTk7op+6L41QCXbGINEmD+ny/G/eCqGzxyCsh7159S+mgDDcoarnBw6PC1PS5+wUGgw==",[m
[31m-      "license": "MIT"[m
[31m-    },[m
[31m-    "node_modules/lodash.once": {[m
[31m-      "version": "4.1.1",[m
[31m-      "resolved": "https://registry.npmjs.org/lodash.once/-/lodash.once-4.1.1.tgz",[m
[31m-      "integrity": "sha512-Sb487aTOCr9drQVL8pIxOzVhafOjZN9UU54hiN8PU3uAiSV7lx1yYNpbNmex2PK6dSJoNTSJUUswT651yww3Mg==",[m
[31m-      "license": "MIT"[m
[31m-    },[m
     "node_modules/math-intrinsics": {[m
       "version": "1.1.0",[m
       "resolved": "https://registry.npmjs.org/math-intrinsics/-/math-intrinsics-1.1.0.tgz",[m
[36m@@ -1430,6 +1410,16 @@[m
         "node": ">= 0.8"[m
       }[m
     },[m
[32m+[m[32m    "node_modules/once": {[m
[32m+[m[32m      "version": "1.4.0",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/once/-/once-1.4.0.tgz",[m
[32m+[m[32m      "integrity": "sha512-lNaJgI+2Q5URQBkccEKHTQOPaXdUxnZZElQTZY0MFUAuaEqe1E+Nyvgdz/aIyNi6Z9MzO5dv1H8n58/GELp3+w==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "ISC",[m
[32m+[m[32m      "dependencies": {[m
[32m+[m[32m        "wrappy": "1"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
     "node_modules/parseurl": {[m
       "version": "1.3.3",[m
       "resolved": "https://registry.npmjs.org/parseurl/-/parseurl-1.3.3.tgz",[m
[36m@@ -1720,6 +1710,7 @@[m
       "version": "7.7.4",[m
       "resolved": "https://registry.npmjs.org/semver/-/semver-7.7.4.tgz",[m
       "integrity": "sha512-vFKC2IEtQnVhpT78h1Yp8wzwrf8CM+MzKMHGJZfBtzhZNycRFnXsHk6E5TxIkkMsgNS7mdX3AGB7x2QM2di4lA==",[m
[32m+[m[32m      "dev": true,[m
       "license": "ISC",[m
       "bin": {[m
         "semver": "bin/semver.js"[m
[36m@@ -1899,6 +1890,90 @@[m
         "safe-buffer": "~5.2.0"[m
       }[m
     },[m
[32m+[m[32m    "node_modules/superagent": {[m
[32m+[m[32m      "version": "10.3.0",[m
[32m+[m[32m      "res