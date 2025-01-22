/**
 * controller.js
 * 用于在启动时与用户交互，分发 Worker 任务，并将结果写入 C 盘根目录。
 */

const readline = require('readline');
const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs');

// 创建 readline 接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * 格式化当前时间，返回 YYYYMMDD_HHMMSS 字符串
 */
function getFormattedTimestamp() {
  const now = new Date();
  const pad = (num) => (num < 10 ? `0${num}` : num);

  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  const second = pad(now.getSeconds());

  return `${year}${month}${day}_${hour}${minute}${second}`;
}

/**
 * 启动一个 Worker 处理某个前缀
 * @param {string} prefix 需要搜索的地址前缀
 * @returns {Promise<{ address: string, seed: string, attempts: number, prefix: string }>}
 */
function runWorker(prefix) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'worker.js'), {
      workerData: { prefix }
    });

    // 收到工作线程发回的匹配结果时
    worker.on('message', (message) => {
      resolve(message);
    });

    worker.on('error', (err) => {
      reject(err);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

/**
 * 并发调度：限制同时运行的 Worker 数量
 * @param {string[]} prefixes 需要搜索的所有前缀
 * @param {number} concurrency 并发线程数
 */
async function findAddresses(prefixes, concurrency) {
  let index = 0;                // 当前要处理的前缀索引
  const results = [];           // 存储搜索结果
  const total = prefixes.length;

  // 核心任务函数：从队列中取前缀并执行 Worker
  async function workerTask() {
    while (index < total) {
      const currentIndex = index++;
      const prefix = prefixes[currentIndex];

      // 运行 Worker
      const result = await runWorker(prefix);
      results.push(result);

      // 将结果写入文件
      const timeStr = getFormattedTimestamp();
      const filename = `${timeStr}_output_${prefix}.txt`;
      const fileContent = 
        `Prefix: ${prefix}\n` +
        `Address: ${result.address}\n` +
        `Seed: ${result.seed}\n` +
        `Attempts: ${result.attempts}\n`;
      
      fs.writeFileSync(filename, fileContent, 'utf8');
      console.log(`前缀 "${prefix}" 的搜索结果已写入: ${filename}`);
    }
  }

  // 启动 concurrency 个并发任务
  const tasks = [];
  for (let i = 0; i < concurrency; i++) {
    tasks.push(workerTask());
  }

  // 等待所有并发任务结束
  await Promise.all(tasks);

  return results;
}

// 第一步：询问用户输入要搜索的前缀（用 . 分隔）
rl.question('Please enter the prefix you want to search--separated by ".") : ', (prefixInput) => {
  if (!prefixInput) {
    console.log('未输入任何前缀，程序退出。');
    rl.close();
    return;
  }

  const prefixes = prefixInput.split('.').map((p) => p.trim()).filter(Boolean);
  if (prefixes.length === 0) {
    console.log('未检测到有效前缀，程序退出。');
    rl.close();
    return;
  }

  // 第二步：询问用户要使用的核心线程数量
  rl.question('Please enter the number of cores (concurrent threads) to be used: ', async (coreInput) => {
    const concurrency = parseInt(coreInput, 10);
    if (isNaN(concurrency) || concurrency <= 0) {
      console.log('he entered core count is invalid, the program will exit.');
      rl.close();
      return;
    }

    // 开始并发搜索
    console.log(`开始搜索前缀: [${prefixes.join(', ')}]，并发线程数: ${concurrency}`);
    try {
      await findAddresses(prefixes, concurrency);
      console.log('All jobs done.');
    } catch (err) {
      console.error('搜索过程中出现错误:', err);
    }

    rl.close();
  });
});
