const getBufferByString = function (data) {
  let bytes = getBytesByString(data)
  return getBufferByBytes(bytes)
}

const getStringByBuffer = function (buffer) {
  let bytes = getBytesByBuffer(buffer)
  return getStringByBytes(bytes)
}

const getBufferByBytes = function (bytes) {
  let dataBuffer = new ArrayBuffer(bytes.length)
  let dataView = new DataView(dataBuffer)
  for (var i = 0; i < bytes.length; i++) {
    dataView.setUint8(i, bytes[i])
  }
  return dataBuffer
}

const getBytesByBuffer = function (buffer) {
  return Array.prototype.map.call(new Uint8Array(buffer), x => x)
}

const getStringByBytes = function (bytes) {
  if (typeof bytes === 'string') {
    return bytes;
  }
  var str = '',
    _arr = bytes;
  for (var i = 0; i < _arr.length; i++) {
    var one = _arr[i].toString(2),
      v = one.match(/^1+?(?=0)/);
    if (v && one.length == 8) {
      var bytesLength = v[0].length;
      var store = _arr[i].toString(2).slice(7 - bytesLength);
      for (var st = 1; st < bytesLength; st++) {
        store += _arr[st + i].toString(2).slice(2);
      }
      str += String.fromCharCode(parseInt(store, 2));
      i += bytesLength - 1;
    } else {
      str += String.fromCharCode(_arr[i]);
    }
  }
  return str;
}

const getBytesByString = function (string) {
  var bytes = new Array();
  var len, c;
  len = string.length;
  for (var i = 0; i < len; i++) {
    c = string.charCodeAt(i);
    if (c >= 0x010000 && c <= 0x10FFFF) {
      bytes.push(((c >> 18) & 0x07) | 0xF0);
      bytes.push(((c >> 12) & 0x3F) | 0x80);
      bytes.push(((c >> 6) & 0x3F) | 0x80);
      bytes.push((c & 0x3F) | 0x80);
    } else if (c >= 0x000800 && c <= 0x00FFFF) {
      bytes.push(((c >> 12) & 0x0F) | 0xE0);
      bytes.push(((c >> 6) & 0x3F) | 0x80);
      bytes.push((c & 0x3F) | 0x80);
    } else if (c >= 0x000080 && c <= 0x0007FF) {
      bytes.push(((c >> 6) & 0x1F) | 0xC0);
      bytes.push((c & 0x3F) | 0x80);
    } else {
      bytes.push(c & 0xFF);
    }
  }
  return bytes;
}

const getHexByBuffer = function (buffer) {
  var hexArr = Array.prototype.map.call(
    new Uint8Array(buffer), function (bit) {
      return ('00' + bit.toString(16)).slice(-2)
    }
  )
  return hexArr.join('')
}

const escape = function (bytes) {
  let new_bytes = []
  for (let i in bytes) {
    switch (bytes[i]) {
      case 0x02:
        new_bytes.push(0x1b)
        new_bytes.push(0x17)
        break;
      case 0x03:
        new_bytes.push(0x1b)
        new_bytes.push(0x18)
        break;
      case 0x1b:
        new_bytes.push(0x1b)
        new_bytes.push(0x19)
        break;
      default:
        new_bytes.push(bytes[i])
    }
  }
  return new_bytes;
}

const unescape = function (bytes) {
  let new_bytes = []
  let escape = false
  for (let i in bytes) {
    if (bytes[i] == 0x1b) {
      escape = true
      continue
    }
    if (escape) {
      switch (bytes[i]) {
        case 0x17:
          new_bytes.push(0x02)
          break;
        case 0x18:
          new_bytes.push(0x03)
          break;
        case 0x19:
          new_bytes.push(0x1b)
          break;
        default:
          console.log('转义不识别字符', bytes[i])
      }
      escape = false
      continue
    }
    new_bytes.push(bytes[i])
  }
  return new_bytes;
}

const createMessagePackage = function (header, body) {
  if (typeof body == 'string') {
    body = getBytesByString(body)
  }

  if (typeof header == 'string') {
    header = getBytesByString(header)
  }

  if (header.length < 255) {
    for (let i = header.length; i < 255; i++) {
      header.push(0x00)
    }
  } else {
    console.log('header长度不能超过255')
    return null
  }
  let new_body = header.concat(body)
  new_body.push(getCRCCode(new_body))
  new_body = escape(new_body)
  let all = [0x02].concat(new_body, [0x03])

  //console.log(all)
  return all
}

const parseMessagePackage = function (bytes) {
  //找头
  let begin = bytes.indexOf(0x02)
  begin = begin < 0 ? 0 : begin + 1

  //找尾
  let end = bytes.indexOf(0x03, begin)
  end = end < 0 ? bytes.length : end

  //console.log('s=', begin, 'e=', end)
  //console.log('s1', bytes)
  bytes = bytes.slice(begin, end) //截取真正的内容
  //console.log('s2',bytes)
  bytes = unescape(bytes) //转义
  //console.log('s3',bytes)
  let crc1 = bytes.pop()
  //console.log('crc1=', crc1)
  let crc2 = getCRCCode(bytes)
  if (crc1 != crc2) {
    console.log('数据校验出错', crc1, crc2)
    return null
  }

  let header = bytes.slice(0, 255) //头
  header = header.filter(function (item) { return item != 0x00 }) //过滤0x00

  let body = bytes.slice(255) //内容

  return {
    header: getStringByBytes(header),
    body: getStringByBytes(body),
  }

}

const getCRCCode = function (bytes) {
  let _crc8 = [
    0x00, 0x5e, 0xbc, 0xe2, 0x61, 0x3f, 0xdd, 0x83,
    0xc2, 0x9c, 0x7e, 0x20, 0xa3, 0xfd, 0x1f, 0x41,
    0x9d, 0xc3, 0x21, 0x7f, 0xfc, 0xa2, 0x40, 0x1e,
    0x5f, 0x01, 0xe3, 0xbd, 0x3e, 0x60, 0x82, 0xdc,
    0x23, 0x7d, 0x9f, 0xc1, 0x42, 0x1c, 0xfe, 0xa0,
    0xe1, 0xbf, 0x5d, 0x03, 0x80, 0xde, 0x3c, 0x62,
    0xbe, 0xe0, 0x02, 0x5c, 0xdf, 0x81, 0x63, 0x3d,
    0x7c, 0x22, 0xc0, 0x9e, 0x1d, 0x43, 0xa1, 0xff,
    0x46, 0x18, 0xfa, 0xa4, 0x27, 0x79, 0x9b, 0xc5,
    0x84, 0xda, 0x38, 0x66, 0xe5, 0xbb, 0x59, 0x07,
    0xdb, 0x85, 0x67, 0x39, 0xba, 0xe4, 0x06, 0x58,
    0x19, 0x47, 0xa5, 0xfb, 0x78, 0x26, 0xc4, 0x9a,
    0x65, 0x3b, 0xd9, 0x87, 0x04, 0x5a, 0xb8, 0xe6,
    0xa7, 0xf9, 0x1b, 0x45, 0xc6, 0x98, 0x7a, 0x24,
    0xf8, 0xa6, 0x44, 0x1a, 0x99, 0xc7, 0x25, 0x7b,
    0x3a, 0x64, 0x86, 0xd8, 0x5b, 0x05, 0xe7, 0xb9,
    0x8c, 0xd2, 0x30, 0x6e, 0xed, 0xb3, 0x51, 0x0f,
    0x4e, 0x10, 0xf2, 0xac, 0x2f, 0x71, 0x93, 0xcd,
    0x11, 0x4f, 0xad, 0xf3, 0x70, 0x2e, 0xcc, 0x92,
    0xd3, 0x8d, 0x6f, 0x31, 0xb2, 0xec, 0x0e, 0x50,
    0xaf, 0xf1, 0x13, 0x4d, 0xce, 0x90, 0x72, 0x2c,
    0x6d, 0x33, 0xd1, 0x8f, 0x0c, 0x52, 0xb0, 0xee,
    0x32, 0x6c, 0x8e, 0xd0, 0x53, 0x0d, 0xef, 0xb1,
    0xf0, 0xae, 0x4c, 0x12, 0x91, 0xcf, 0x2d, 0x73,
    0xca, 0x94, 0x76, 0x28, 0xab, 0xf5, 0x17, 0x49,
    0x08, 0x56, 0xb4, 0xea, 0x69, 0x37, 0xd5, 0x8b,
    0x57, 0x09, 0xeb, 0xb5, 0x36, 0x68, 0x8a, 0xd4,
    0x95, 0xcb, 0x29, 0x77, 0xf4, 0xaa, 0x48, 0x16,
    0xe9, 0xb7, 0x55, 0x0b, 0x88, 0xd6, 0x34, 0x6a,
    0x2b, 0x75, 0x97, 0xc9, 0x4a, 0x14, 0xf6, 0xa8,
    0x74, 0x2a, 0xc8, 0x96, 0x15, 0x4b, 0xa9, 0xf7,
    0xb6, 0xe8, 0x0a, 0x54, 0xd7, 0x89, 0x6b, 0x35
  ]

  let len = bytes.length;
  let crc = 0x00;
  for (let i in bytes) {
    crc = _crc8[crc ^ bytes[i]];
  }
  return crc
}

module.exports = {
  getBufferByString: getBufferByString,
  getStringByBuffer: getStringByBuffer,

  getBufferByBytes: getBufferByBytes,
  getBytesByBuffer: getBytesByBuffer,

  getStringByBytes: getStringByBytes,
  getBytesByString: getBytesByString,

  escape: escape, //转义
  unescape: unescape, //还原

  getHexByBuffer: getHexByBuffer, //生成16位显示
  createMessagePackage: createMessagePackage,
  parseMessagePackage: parseMessagePackage
}

