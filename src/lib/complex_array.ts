export default class ComplexArray {
  real: Float32Array
  imag: Float32Array
  length: number
  ArrayType: Float32ArrayConstructor

  constructor(n: number, arrayType = Float32Array) {
    this.ArrayType = arrayType
    this.real = new arrayType(n)
    this.imag = new arrayType(n)
    this.length = n
  }

  map(transform: (freq: { real: number, imag: number }, i: number, n: number) => void) {
    for (let i = 0; i < this.length; i++) {
      transform({
        real: this.real[i],
        imag: this.imag[i]
      }, i, this.length)
    }
    return this
  }
} 