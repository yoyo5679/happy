// Next invokes this after static export, including when hosting runs `next build` directly.
module.exports={name:'happycare-security-headers',onBuildComplete(){require('./build-headers.cjs');}};
