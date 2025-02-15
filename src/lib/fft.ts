import ComplexArray from "./complex_array"

const PI = Math.PI
const SQRT1_2 = Math.SQRT1_2

export function FFT(input: ComplexArray) {
  return fft(input, false)
}

function fft(input: ComplexArray, inverse: boolean) {
  const n = input.length

  if (n & (n - 1)) {
    return FFT_Recursive(input, inverse)
  } else {
    return FFT_2_Iterative(input, inverse)
  }
}

function FFT_2_Iterative(input: ComplexArray, inverse: boolean) {
  const n = input.length
  const output = BitReverseComplexArray(input)
  const output_r = output.real
  const output_i = output.imag

  let width = 1
  while (width < n) {
    const del_f_r = Math.cos(PI/width)
    const del_f_i = (inverse ? -1 : 1) * Math.sin(PI/width)
    for (let i = 0; i < n/(2*width); i++) {
      let f_r = 1
      let f_i = 0
      for (let j = 0; j < width; j++) {
        const l_index = 2*i*width + j
        const r_index = l_index + width

        const left_r = output_r[l_index]
        const left_i = output_i[l_index]
        const right_r = f_r * output_r[r_index] - f_i * output_i[r_index]
        const right_i = f_i * output_r[r_index] + f_r * output_i[r_index]

        output_r[l_index] = SQRT1_2 * (left_r + right_r)
        output_i[l_index] = SQRT1_2 * (left_i + right_i)
        output_r[r_index] = SQRT1_2 * (left_r - right_r)
        output_i[r_index] = SQRT1_2 * (left_i - right_i)

        const tmp_r = f_r * del_f_r - f_i * del_f_i
        f_i = f_r * del_f_i + f_i * del_f_r
        f_r = tmp_r
      }
    }
    width <<= 1
  }

  return output
}

function BitReverseComplexArray(array: ComplexArray) {
  const n = array.length
  const flips = new Set()

  for(let i = 0; i < n; i++) {
    const r_i = BitReverseIndex(i, n)

    if (flips.has(i)) continue

    const tmp_r = array.real[i]
    array.real[i] = array.real[r_i]
    array.real[r_i] = tmp_r

    const tmp_i = array.imag[i]
    array.imag[i] = array.imag[r_i]
    array.imag[r_i] = tmp_i

    flips.add(r_i)
  }

  return array
}

function BitReverseIndex(index: number, n: number) {
  let bitreversed_index = 0

  while (n > 1) {
    bitreversed_index <<= 1
    bitreversed_index += index & 1
    index >>= 1
    n >>= 1
  }
  return bitreversed_index
}

function FFT_Recursive(input: ComplexArray, inverse: boolean) {
  const n = input.length

  if (n === 1) {
    return input
  }

  const output = new ComplexArray(n)

  const p = LowestOddFactor(n)
  const m = n / p
  const normalisation = 1 / Math.sqrt(p)
  let recursive_result = new ComplexArray(m)

  for(let j = 0; j < p; j++) {
    for(let i = 0; i < m; i++) {
      recursive_result.real[i] = input.real[i * p + j]
      recursive_result.imag[i] = input.imag[i * p + j]
    }
    if (m > 1) {
      recursive_result = fft(recursive_result, inverse)
    }

    const del_f_r = Math.cos(2*PI*j/n)
    const del_f_i = (inverse ? -1 : 1) * Math.sin(2*PI*j/n)
    let f_r = 1
    let f_i = 0

    for(let i = 0; i < n; i++) {
      const _real = recursive_result.real[i % m]
      const _imag = recursive_result.imag[i % m]

      output.real[i] += f_r * _real - f_i * _imag
      output.imag[i] += f_r * _imag + f_i * _real

      const tmp_r = f_r * del_f_r - f_i * del_f_i
      f_i = f_r * del_f_i + f_i * del_f_r
      f_r = tmp_r
    }
  }

  for(let i = 0; i < n; i++) {
    input.real[i] = normalisation * output.real[i]
    input.imag[i] = normalisation * output.imag[i]
  }

  return input
}

function LowestOddFactor(n: number) {
  const sqrt_n = Math.sqrt(n)
  let factor = 3

  while(factor <= sqrt_n) {
    if (n % factor === 0) return factor
    factor += 2
  }
  return n
}

export { ComplexArray } 