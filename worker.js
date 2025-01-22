/**
 * worker.js
 * 工作线程：根据传入的前缀 prefix，持续生成随机地址直到匹配，再将结果返回给主线程。
 */

const { parentPort, workerData } = require('worker_threads');
const { generateSeed, deriveKeypair, deriveAddress } = require('ripple-keypairs');

(async function main() {
  const prefix = workerData.prefix;
  let attempts = 0;

  while (true) {
    attempts++;
    const seed = generateSeed();
    const keypair = deriveKeypair(seed);
    const address = deriveAddress(keypair.publicKey);

    if (address.startsWith(prefix)) {
      // 找到符合前缀的地址，发送消息给主线程
      parentPort.postMessage({
        prefix,
        address,
        seed,
        attempts
      });
      break;
    }

    // 可选：每过一定数量可打印进度
    if (attempts % 10000 === 0) {
      // 注意: 在大量并发下，控制台输出过多会影响性能
      // console.log(`[Worker: ${prefix}] 已尝试 ${attempts} 次...`);
    }
  }
})();
