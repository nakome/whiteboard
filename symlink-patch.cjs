const fs = require("fs");
const fsp = fs.promises;

function wrap(orig) {
  return function(target, path, type, callback) {
    if (typeof type === "function") {
      callback = type;
      type = "junction";
    } else if (type == null || type === "dir" || type === "symlink") {
      type = "junction";
    }
    return orig.call(this, target, path, type, callback);
  };
}

function wrapSync(orig) {
  return function(target, path, type) {
    if (type == null || type === "dir" || type === "symlink") type = "junction";
    return orig.call(this, target, path, type);
  };
}

function wrapPromise(orig) {
  return function(target, path, type) {
    if (type == null || type === "dir" || type === "symlink") type = "junction";
    return orig.call(this, target, path, type);
  };
}

fs.symlink = wrap(fs.symlink);
fs.symlinkSync = wrapSync(fs.symlinkSync);
if (fsp && fsp.symlink) fsp.symlink = wrapPromise(fsp.symlink.bind(fsp));