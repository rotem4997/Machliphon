// Pure-TypeScript logistic regression with batch gradient descent.
// Tiny, dependency-free, deterministic — designed for the Machliphon dataset
// scale (hundreds-to-thousands of rows per authority).

export interface LogRegModel {
  weights: number[];   // length = n_features
  bias: number;
  featureNames: string[];
  // Per-feature mean/std used at training time for standardization.
  mean: number[];
  std: number[];
}

export interface TrainOptions {
  epochs?: number;
  learningRate?: number;
  l2?: number;          // L2 regularization strength
}

const sigmoid = (z: number) => {
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
};

function standardize(X: number[][]): { mean: number[]; std: number[]; Xs: number[][] } {
  const n = X.length;
  const d = X[0]?.length ?? 0;
  const mean = new Array(d).fill(0);
  const std = new Array(d).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) mean[j] += X[i][j];
  }
  for (let j = 0; j < d; j++) mean[j] /= Math.max(n, 1);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) std[j] += (X[i][j] - mean[j]) ** 2;
  }
  for (let j = 0; j < d; j++) {
    std[j] = Math.sqrt(std[j] / Math.max(n - 1, 1));
    if (std[j] < 1e-9) std[j] = 1; // constant features → leave untouched
  }
  const Xs = X.map(row => row.map((v, j) => (v - mean[j]) / std[j]));
  return { mean, std, Xs };
}

export function trainLogReg(
  X: number[][],
  y: number[],
  featureNames: string[],
  opts: TrainOptions = {},
): LogRegModel {
  const epochs = opts.epochs ?? 200;
  const lr = opts.learningRate ?? 0.1;
  const l2 = opts.l2 ?? 0.01;
  const n = X.length;
  const d = X[0]?.length ?? 0;

  if (n === 0 || d === 0) {
    return { weights: new Array(d).fill(0), bias: 0, featureNames, mean: new Array(d).fill(0), std: new Array(d).fill(1) };
  }

  const { mean, std, Xs } = standardize(X);

  const w = new Array(d).fill(0);
  let b = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array(d).fill(0);
    let gradB = 0;
    for (let i = 0; i < n; i++) {
      let z = b;
      for (let j = 0; j < d; j++) z += w[j] * Xs[i][j];
      const p = sigmoid(z);
      const err = p - y[i];
      for (let j = 0; j < d; j++) gradW[j] += err * Xs[i][j];
      gradB += err;
    }
    for (let j = 0; j < d; j++) {
      w[j] -= lr * (gradW[j] / n + l2 * w[j]);
    }
    b -= lr * (gradB / n);
  }

  return { weights: w, bias: b, featureNames, mean, std };
}

export function predictProba(model: LogRegModel, x: number[]): number {
  if (x.length !== model.weights.length) {
    throw new Error(`Feature length mismatch: got ${x.length}, model expects ${model.weights.length}`);
  }
  let z = model.bias;
  for (let j = 0; j < model.weights.length; j++) {
    const std = model.std[j] || 1;
    const xs = (x[j] - model.mean[j]) / std;
    z += model.weights[j] * xs;
  }
  return sigmoid(z);
}

// Compute ROC-AUC by sorting predictions and integrating.
export function rocAuc(yTrue: number[], yScore: number[]): number {
  const pairs = yTrue.map((y, i) => ({ y, s: yScore[i] }));
  const pos = pairs.filter(p => p.y === 1).length;
  const neg = pairs.length - pos;
  if (pos === 0 || neg === 0) return 0.5;
  pairs.sort((a, b) => b.s - a.s);
  let tp = 0, fp = 0, prevTp = 0, prevFp = 0, auc = 0;
  for (const p of pairs) {
    if (p.y === 1) tp++; else fp++;
    if (fp !== prevFp) {
      auc += ((tp + prevTp) / 2) * (fp - prevFp);
      prevTp = tp; prevFp = fp;
    }
  }
  auc += ((tp + prevTp) / 2) * (fp - prevFp);
  return auc / (pos * neg);
}
