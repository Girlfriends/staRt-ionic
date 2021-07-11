    /**
 * @file AudioManager.cpp
 * @Author Jon Forsyth
 * @date 1/16/14
 * @brief Classes and functions used in audio analysis.
 */

#include <complex>
#include <math.h>
#include <Accelerate/Accelerate.h>
#include "AudioManager.h"

DoubleBuffer::DoubleBuffer(UInt32 bufferSize, UInt32 numBuffers) :
_curr_write_idx(0),
_curr_read_idx(1)
{
    m_buffer_size = bufferSize;
    m_num_buffers = numBuffers;

    _buffer_list = new Float32*[this->m_num_buffers];

    for (int i=0; i<this->m_num_buffers; i++) {
        _buffer_list[i] = new Float32[m_buffer_size];
        memset(_buffer_list[i], 0, m_buffer_size * sizeof(Float32));
    }
}

DoubleBuffer::~DoubleBuffer()
{
    for (int i=0; i<this->m_num_buffers; i++) {
        delete [] _buffer_list[i];
    }
}

void DoubleBuffer::writeBuffer(Float32 *inBuffer)
{
    memcpy(_buffer_list[_curr_write_idx], inBuffer, m_buffer_size * sizeof(Float32));
    _curr_read_idx = _curr_write_idx;
    _curr_write_idx = (_curr_write_idx + 1) % this->m_num_buffers;
}

void DoubleBuffer::readBuffer(Float32 *outBuffer)
{
    memcpy(outBuffer, _buffer_list[_curr_read_idx], m_buffer_size * sizeof(Float32));
}

void DoubleBuffer::resetAllBuffers()
{
    for (int i=0; i<this->m_num_buffers; i++) {
        memset(_buffer_list[i], 0, m_buffer_size * sizeof(Float32));
    }
}

void DoubleBuffer::averageAllBuffers(Float32 *avgBuffer)
{
    memset(avgBuffer, 0, this->m_buffer_size * sizeof(Float32));
    for (int i=0; i<this->m_num_buffers; i++) {
        for (int j=0; j<this->m_buffer_size; j++) {
            avgBuffer[j] += this->_buffer_list[i][j]/(Float32)this->m_buffer_size;
        }
    }
}


/* ------------------------------------------------------- */
/* ---------------    AudioManager   --------------------- */
/* ------------------------------------------------------- */

AudioManager::AudioManager(UInt32 lpcBuffSize, UInt32 lpcOrder, UInt32 magSpecRes, Float32 sampleRate):
_computeLPC(false)
{
    m_lpc_BufferSize = lpcBuffSize;
    m_lpc_magSpecResolution = magSpecRes;
    m_sampleRate = sampleRate;

    m_gain = 0.0;
    this->setLPCOrder(lpcOrder);

    _double_buffer = new DoubleBuffer(m_lpc_BufferSize, DBLBUF_NUM_BUFFERS);

    m_lpc_mag_buffer = new Float32[m_lpc_BufferSize];
    memset(m_lpc_mag_buffer, 0, m_lpc_BufferSize * sizeof(Float32));

    // Hanning window
    _win = new Float32[m_lpc_BufferSize];
    vDSP_hann_window(_win, m_lpc_BufferSize, vDSP_HANN_NORM);

}

AudioManager::~AudioManager()
{

    delete [] m_lpc_mag_buffer;
    delete [] _win;
    delete _double_buffer;
}


void AudioManager::grabAudioData(Float32 *inAudioBuffer)
{
    _double_buffer->writeBuffer(inAudioBuffer);
}

/* LPC stuff */
void AudioManager::setLPCOrder(UInt32 lpcOrder)
{
    if (lpcOrder>MAX_LPC_ORDER) {
        lpcOrder = MAX_LPC_ORDER;
    }
    m_lpc_order = lpcOrder;

    //_double_buffer->resetAllBuffers();
    memset(m_lpc_coeffs, 0, (m_lpc_order+1) * sizeof(double));
}

void AudioManager::computeLPC()
{
    if (!_computeLPC) {
        return;
    }

    // get current read buffer
    Float32 curr_audio_buffer[m_lpc_BufferSize];

    _double_buffer->readBuffer(curr_audio_buffer);

    // remove mean
    vDSP_Stride stride = (vDSP_Stride)1;
    float mean;
    vDSP_meanv((float *)curr_audio_buffer, stride, &mean, m_lpc_BufferSize);
    mean = -mean;
    vDSP_vsadd(curr_audio_buffer, stride, &mean, curr_audio_buffer, stride, m_lpc_BufferSize);

    // apply window to buffer
    vDSP_vmul(curr_audio_buffer,(vDSP_Stride)1,_win,(vDSP_Stride)1,curr_audio_buffer,(vDSP_Stride)1,m_lpc_BufferSize);

    // apply high-pass filter
    Float32 tmpBuff[m_lpc_BufferSize];
    memcpy(tmpBuff, curr_audio_buffer, m_lpc_BufferSize * sizeof(Float32));
    memset(curr_audio_buffer, 0, m_lpc_BufferSize * sizeof(Float32));
    this->highPassFilter(tmpBuff, curr_audio_buffer, m_lpc_BufferSize);

    // compute LPC coefficients
    memset(m_lpc_coeffs, 0, (m_lpc_order+1) * sizeof(double));

    double lpc_coeffs[m_lpc_order];
    lpc_from_data(m_lpc_order, m_lpc_BufferSize, curr_audio_buffer, lpc_coeffs);
    m_lpc_coeffs[0] = 1.0;
    for (int i=1; i<m_lpc_order+1; i++) {
        m_lpc_coeffs[i] = -lpc_coeffs[i-1];
    }

    Float32 gain = 0.5;
    this->computeLPCFreqRespV(gain);
}

void AudioManager::computeLPCFreqResp(Float32 gain)
{
    double incr = M_PI / ((double)m_lpc_magSpecResolution - 1.0);
    std::complex<double> I(0.0,1.0);
    std::complex<double> One(1.0,0.0);

    for (int k=0; k<m_lpc_magSpecResolution; k++) {
        std::complex<double> tmp_sum(0.0,0.0);
        double angle = ((double)k)*incr;
        for (int j=0; j<m_lpc_order+1; j++) {
            tmp_sum += m_lpc_coeffs[j] * exp(angle*j*I);
        }
        m_lpc_mag_buffer[k] = gain/(abs(tmp_sum) + 1e-20);
    }
}

void AudioManager::computeLPCFreqRespV(Float32 gain)
{
    double incr = M_PI / ((double)m_lpc_magSpecResolution - 1.0);
    float vin[m_lpc_magSpecResolution][(m_lpc_order+1)*2];
    float vout[m_lpc_magSpecResolution][(m_lpc_order+1)*2];

    for (int k=0; k<m_lpc_magSpecResolution; k++) {
        double angle = ((double)k)*incr;
        for (int j=0; j<m_lpc_order+1; j++) {
            vin[k][2*j] = m_lpc_coeffs[j];
            vin[k][2*j+1] = angle*j;
        }
    }
    vDSP_rect((float *)vin, 2, (float *)vout, 2, (m_lpc_order+1) * m_lpc_magSpecResolution);
    for (int k=0; k<m_lpc_magSpecResolution; k++) {
        std::complex<double> tmp_sum(0.0,0.0);
        for (int j=0; j<m_lpc_order+1; j++) {
            tmp_sum += std::complex<double>(vout[k][2*j], vout[k][2*j+1]);
        }
        m_lpc_mag_buffer[k] = gain/(abs(tmp_sum) + 1e-20);
    }
}

void AudioManager::highPassFilter(Float32 *inBuffer, Float32 *outBuffer, UInt32 winSize)
{
    Float32 delsmp = 0.0f;
    for (UInt32 i=0; i<winSize; i++) {
        outBuffer[i] = inBuffer[i] - 0.94*delsmp;
        delsmp = inBuffer[i];
    }
}

/* ------------------------------------------------------- */
/* ---------------      functions    --------------------- */
/* ------------------------------------------------------- */


void lpc_from_data(long order, long size, float *data, double *coeffs)
{
    double r_mat[MAX_LPC_ORDER][MAX_LPC_ORDER];
    long i,j;
    float corr[MAX_BLOCK_SIZE];

    autocorr(size,data,corr);

    // New, hardware accelerated matrix inverse
    for (i=1;i<order;i++) {
        for (j=1;j<order;j++) r_mat[(i-1)][(j-1)] = corr[abs(i-j)];
    }
    vminvert(order-1,r_mat);
    for (i=0;i<order-1;i++)     {
        coeffs[i] = 0.0;
        for (j=0;j<order-1;j++)    {
            coeffs[i] += r_mat[i][j] * corr[1+j];
        }
    }

    // Old, non-hardware accelerated inverse
    /*
     for (i=1;i<order;i++) {
     for (j=1;j<order;j++) r_mat[i][j] = corr[abs(i-j)];
     }
     minvert(order-1,r_mat);
     for (i=0;i<order-1;i++)     {
     coeffs[i] = 0.0;
     for (j=0;j<order-1;j++)    {
     coeffs[i] += r_mat[i+1][j+1] * corr[1+j];
     }
     }
     */
}

void autocorr(long size, float *data, float *result)
{
    long i,j,k;
    double temp,norm;

    for (i=0;i<size/2;i++) {
        result[i] = 0.0;
        for (j=0;j<size-i-1;j++)    {
            result[i] += data[i+j] * data[j];
        }
    }

    // find positive slope, store in j
    temp = result[0];
    j = (long) size*0.02;
    while (result[j]<temp && j < size/2)    {
        temp = result[j];
        j += 1;
    }

    temp = 0.0;
    for (i=j;i<size*0.5;i++) {
        if (result[i]>temp) {
            j = i;
            temp = result[i];
        }
    }
    norm = 1.0 / size;
    k = size/2;
    for (i=0;i<size/2;i++)
        result[i] *=  (k - i) * norm;
    if (result[j] == 0) j = 0;
    else if ((result[j] / result[0]) < 0.4) j = 0;
    else if (j > size/4) j = 0;
}

void vautocorr(long size, float *data, float *result)
{
    long i,j,k;
    double temp,norm;
    float *signal, *filter;
    uint32_t lenSignal, filterLength, resultLength;

    filterLength = size;
    resultLength = filterLength;
    lenSignal = ((filterLength + 3) & 0xFFFFFFFC) + resultLength;

    signal = (float *) calloc(lenSignal, sizeof(float));
    filter = (float *) malloc(filterLength * sizeof(float));

    for (i = 0; i < filterLength; i++)
        filter[i] = data[i];

    for (i = 0; i < resultLength; i++)
        if (i >=resultLength- filterLength)
            signal[i] = filter[i - filterLength+1];

    vDSP_conv(signal, 1, filter, 1, result, 1, resultLength, filterLength);
    free(signal);
    free(filter);

    // find positive slope, store in j
    temp = result[0];
    j = (long) size*0.02;
    while (result[j]<temp && j < size/2)    {
        temp = result[j];
        j += 1;
    }

    temp = 0.0;
    for (i=j;i<size*0.5;i++) {
        if (result[i]>temp) {
            j = i;
            temp = result[i];
        }
    }
    norm = 1.0 / size;
    k = size/2;
    for (i=0;i<size/2;i++)
        result[i] *=  (k - i) * norm;
    if (result[j] == 0) j = 0;
    else if ((result[j] / result[0]) < 0.4) j = 0;
    else if (j > size/4) j = 0;
}

long minvert(long size, double mat[][MAX_LPC_ORDER])
{
    long item,row,col,rank=0; //,t2;
    double temp,res[MAX_LPC_ORDER][MAX_LPC_ORDER];
    //    long ok,zerorow;

    for (row=1;row<=size;row++)     {
        for (col=1;col<=size;col++)    {
            //    printf(stdout," %f ",mat[row][col]);
            if (row==col)
                res[row][col] = 1.0;
            else
                res[row][col] = 0.0;
        }
        //    fprintf(stdout,"\n");
    }
    for (item=1;item<=size;item++) {
        if (mat[item][item]==0)        {
            for (row=item;row<=size;row++)   {
                for (col=1;col<=size;col++)    {
                    mat[item][col] = mat[item][col] + mat[row][col];
                    res[item][col] = res[item][col] + res[row][col];
                }
            }
        }
        for (row=item;row<=size;row++)  {
            temp=mat[row][item];
            if (temp!=0)    {
                for (col=1;col<=size;col++)    {
                    mat[row][col] = mat[row][col] / temp;
                    res[row][col] = res[row][col] / temp;
                }
            }
        }
        if (item!=size)    {
            for (row=item+1;row<=size;row++)    {
                temp=mat[row][item];
                if (temp!=0)    {
                    for (col=1;col<=size;col++)    {
                        mat[row][col] = mat[row][col] - mat[item][col];
                        res[row][col] = res[row][col] - res[item][col];
                    }
                }
            }
        }
    }
    for (item=2;item<=size;item++)   {
        for (row=1;row<item;row++)    {
            temp = mat[row][item];
            for (col=1;col<=size;col++)       {
                mat[row][col] = mat[row][col] - temp * mat[item][col];
                res[row][col] = res[row][col] - temp * res[item][col];
            }
        }
    }
    /*    ok = TRUE;
     rank = 0;
     for (row=1;row<=size;row++)    {
     zerorow = TRUE;
     for (col=1;col<=size;col++)    {
     if (mat[row][col]!=0) zerorow = FALSE;
     t2 = (mat[row][col] + 0.5);
     if (row==col&&t2!=1) ok = FALSE;
     t2 = fabs(mat[row][col]*100.0);
     if (row!=col&&t2!=0) ok = FALSE;
     }
     if (!zerorow) rank += 1;
     }
     if (!ok)    {
     fprintf(stdout,"Matrix Not Invertible\n");
     fprintf(stdout,"Rank is Only %i of %i\n",rank,size);
     }                                    */
    for (row=1;row<=size;row++)    {
        for (col=1;col<=size;col++)    {
            mat[row][col] = res[row][col];
        }
    }
    return rank;
}

void vminvert(long size, double mat[][MAX_LPC_ORDER])
{
    __CLPK_integer error=0;
    __CLPK_integer lda = MAX_LPC_ORDER;
    __CLPK_integer pivot[MAX_LPC_ORDER];
    __CLPK_doublereal workspace[MAX_LPC_ORDER];
    __CLPK_integer N = size;

    /*  LU factorisation */
    dgetrf_(&N, &N, (__CLPK_doublereal *)mat, &lda, pivot, &error);

    if (error != 0) {
        // handle the error
    }

    /*  matrix inversion */
    dgetri_(&N, (__CLPK_doublereal *)mat, &lda, pivot, workspace, &N, &error);

    if (error != 0) {
        // handle the second error
    }
}


/* ------------------------------------------------------- */
/* ---------------     helper functions ------------------ */
/* ------------------------------------------------------- */

int sign(Float32 v)
{
    if (v>0.0) return 1;
    else if (v<0.0) return -1;
    else return 0;
}

/*
 Peaks and Valleys Helper functions
 @Authors: Tae Hong Park, Karan Pareek, Scott Murakami
 */

float meanValue(float a, float b){
    return (a+b)/2;
}

float computeMean(float *array, int endLimit){
    float localSum = 0.0;
    int localCount = 0;
    for (int i = 0; i < endLimit; i++){
        if (array[i] != -1.0){
            localSum += array[i];
            localCount++;
        }
        else{
            continue;
        }
    }
    return localSum/(float)localCount;
}

float computeStdDev(float *array, int endLimit){
    float meanValue = computeMean(array, endLimit);
    float localSum = 0.0;
    int localCount = 0;
    for (int i = 0; i < endLimit; i++){
        if (array[i] != -1.0){
            localSum += (array[i] - meanValue);
            localCount++;
        }
    }
    return localSum/(float)localCount;
}

//float noiseGenerator(float amplitude, int lenth){
//
//}

/* ------------------------------------------------------- */
/* ---------------- Peak Detector Class ------------------ */
/*  @Authors: Tae Hong Park, Karan Pareek, Scott Murakami  */
/* ------------------------------------------------------- */


PeaksAndValleys::PeaksAndValleys(){

    // Initialize class values
    valleyPair      = 0;
    cntValley       = 0;
    cntPeak         = 0;
    prevSlopePos    = 1;
    noiseFloor      = -100;
    init            = false;
    initDisplayPtr  = false;

    // Create new structs
    peaks   = new PEAKS;
    valleys = new VALLEYS;
}

PeaksAndValleys::~PeaksAndValleys(){

    delete [] peaks->freq;
    delete [] peaks->mag;
    delete [] valleys->freq;
    delete [] valleys->mag;

    delete peaks;
    delete valleys;

    free(initValue);
    free(slopes);
}

void PeaksAndValleys::displayInit(float *signal, unsigned int signalLength){

    sigPointer     = signal;
    len            = signalLength - 1;

    // Initialize all values to -1
    initValue = (float*) calloc(signalLength, sizeof(float));
    for (int i = 0; i < signalLength; i++){
        initValue[i] = -1.0;
    }

    slopes = (float*) calloc(len, sizeof(float));
    for (int i = 0; i < len; i++){
        slopes[i] = -1.0;
    }

    // PEAKS
    peaks->freq   = (float*) malloc(signalLength * sizeof(float));
    peaks->mag   = (float*) malloc(signalLength * sizeof(float));
    memcpy(peaks->freq, initValue, signalLength * sizeof(float));
    memcpy(peaks->mag, initValue, signalLength * sizeof(float));

    // VALLEYS
    valleys->freq = (float*) malloc(signalLength * sizeof(float));
    valleys->mag = (float*) malloc(signalLength * sizeof(float));
    memcpy(valleys->freq, initValue, signalLength * sizeof(float));
    memcpy(valleys->mag, initValue, signalLength * sizeof(float));

    for (int i = 0; i < FREQ_RESP_LEN; i++){
        peaks->height.left[i]  = 0;
        peaks->height.right[i] = 0;
        peaks->spread.left[i]  = 0;
        peaks->spread.right[i] = 0;
        peaks->slope.left[i]   = 0;
        peaks->slope.right[i]  = 0;
    }

    peaks->height.leftMean  = 0.0;
    peaks->height.rightMean = 0.0;
    peaks->spread.leftMean  = 0.0;
    peaks->spread.rightMean = 0.0;
    peaks->slope.leftMean   = 0.0;
    peaks->slope.rightMean  = 0.0;

    // Compute the peaks and valleys for the incoming signal
//    computeParams(signal);
}

void PeaksAndValleys::resetValues(unsigned int signalLength){

    len             = signalLength - 1;
    valleyPair      = 0;
    cntValley       = 0;
    cntPeak         = 0;
    prevSlopePos    = 1;
    noiseFloor      = -100;
    init            = false;

    memcpy(peaks->freq, initValue, signalLength * sizeof(float));
    memcpy(peaks->mag, initValue, signalLength * sizeof(float));

    memcpy(valleys->freq, initValue, signalLength * sizeof(float));
    memcpy(valleys->mag, initValue, signalLength * sizeof(float));

    for (int i = 0; i < FREQ_RESP_LEN; i++){
        peaks->height.left[i]  = 0;
        peaks->height.right[i] = 0;
        peaks->spread.left[i]  = 0;
        peaks->spread.right[i] = 0;
        peaks->slope.left[i]   = 0;
        peaks->slope.right[i]  = 0;
    }

    peaks->height.leftMean  = 0.0;
    peaks->height.rightMean = 0.0;
    peaks->spread.leftMean  = 0.0;
    peaks->spread.rightMean = 0.0;
    peaks->slope.leftMean   = 0.0;
    peaks->slope.rightMean  = 0.0;
}

void PeaksAndValleys::computeParams(float *signal){

    // Compute slopes array
    for (int i = 0; i < len; i++){
        slopes[i] = 0.5*(signal[i+1] - signal[i]);
    }

    // Find slope changes
    if (slopes[0] > 0) {
        updateValleys(0);
        addPeaksAndValleys(1);
    }
    else {
        prevSlopePos = 0;
        addPeaksAndValleys(0);
    }

    if (!prevSlopePos){
        for (int j = 0; j < len; j++){
            if (valleys->freq[j] < 0){
                valleys->freq[j] = len+1;
                valleys->mag[j] = sigPointer[len+1];
                break;
            }
        }
    }

    if (cntPeak != 0){
        cntPeak = cntPeak - 1;
    }

    // Peak height, spread and slope analysis
    analysis();

    // Compute adaptive filtering for thresholding
    postFiltering();

    // Compute statistics for class parameters (mean & std)
    computeStats();
}

void PeaksAndValleys::addPeaksAndValleys(int isPos){
    for (int i = 1; i < len; i++) {
        if (sign(slopes[i]) < 0 && prevSlopePos) {
            updatePeaks(i);
            prevSlopePos = 0;
        }
        else if (sign(slopes[i]) >= 0 && !prevSlopePos){
            updateValleys(i);
            prevSlopePos = 1;
        }
    }
}

//void PeaksAndValleys::slopePos(){
//
//    for (int i = 0; i < len; i++){
//        if (sign(slopes[i]) < 0){
//            if (!init){
//                init = true;
//                prevSlopePos = 0;
//                continue;
//            }
//            if (prevSlopePos){
//                updatePeaks(i);
//                prevSlopePos = 0;
//            }
//        }
//        else{
//            if (!init){
//                updateValleys(i);
//                init = true;
//                continue;
//            }
//            if (!prevSlopePos){
//                updateValleys(i);
//            }
//            prevSlopePos = 1;
//        }
//    }
//}

void PeaksAndValleys::updatePeaks(int k){

    peaks->freq[cntPeak] = k;
    peaks->mag[cntPeak] = sigPointer[k];

    cntPeak = cntPeak + 1;
}

void PeaksAndValleys::updateValleys(int k){
    valleys->freq[cntValley] = k;
    valleys->mag[cntValley] = sigPointer[k];
    // We always make sure we have a valley to the left of a peak and a valley to the right of a peak.
    if (cntValley % 2 == 0) {
        valleys->freq[cntValley + 1] = -1;
        valleys->mag[cntValley + 1] = sigPointer[k];
    }
    cntValley += 1;
}

void PeaksAndValleys::postFiltering(){

    /* METHOD 1
     * Adaptive Threshold based on calculated Noise Floor
     */

    float magSum = 0.0;
    for (int i = 0; i < (cntPeak + 1); i++){
        magSum += valleys->mag[i];
    }

    // Compute noise floor
    noiseFloor = computeMean(valleys->mag, cntPeak+1);

    // Processing idx and mag values that lie above the threshold
    for (int i = 0; i < cntPeak; i++){
        if (peaks->mag[i] < noiseFloor){
            peaks->mag[i] = -1;
        }
    }

    /* METHOD 2
     * Pick the max peak between left & right peaks
     * Manually set threshold value for peaks
     */

    /*
    float maxValue   = 0.0;
    float peakThresh = 0.0;
     for (int i = 0; i < cntPeak; i++){
         maxValue = std::max(peaks->height.left[i], peaks->height.right[i]);
         peakThresh = 0.07; // adjust this setting for more or less sensitivity
         if (maxValue < peakThresh){
             peaks->mag[i] = -1;
         }
     }
     */
}

void PeaksAndValleys::analysis(){

    int k;
    float diffL, diffR, slopeL, slopeR;

    for (k = 0; k < cntPeak; k++){
        diffL = std::abs(peaks->mag[k] - valleys->mag[k]);
        diffR = std::abs(peaks->mag[k] - valleys->mag[k+1]);

        peaks->height.left[k]  = std::max(diffL, diffR);
        peaks->height.right[k] = meanValue(diffL, diffR);

        slopeL = diffL / (peaks->freq[k] - valleys->freq[k]);
        slopeR = diffR / (valleys->freq[k+1] - peaks->freq[k]);

        peaks->slope.left[k]  = std::max(slopeL, slopeR);
        peaks->slope.right[k] = meanValue(slopeL, slopeR);

        peaks->spread.left[k]  = peaks->freq[k] - valleys->freq[k];
        peaks->spread.right[k] = valleys->freq[k+1] - peaks->freq[k];
    }
}

void PeaksAndValleys::computeStats(){

    peaks->height.leftMean  = computeMean(peaks->height.left, cntPeak);
    peaks->height.rightMean = computeMean(peaks->height.right, cntPeak);
    peaks->spread.leftMean  = computeMean(peaks->spread.left, cntPeak);
    peaks->spread.rightMean = computeMean(peaks->spread.right, cntPeak);
    peaks->slope.leftMean   = computeMean(peaks->slope.left, cntPeak);
    peaks->slope.rightMean  = computeMean(peaks->slope.right, cntPeak);

    peaks->height.leftStdDev  = computeStdDev(peaks->height.left, cntPeak);
    peaks->height.rightStdDev = computeStdDev(peaks->height.right, cntPeak);
    peaks->spread.leftStdDev  = computeStdDev(peaks->spread.left, cntPeak);
    peaks->spread.rightStdDev = computeStdDev(peaks->spread.right, cntPeak);
    peaks->slope.leftStdDev   = computeStdDev(peaks->slope.left, cntPeak);
    peaks->slope.rightStdDev  = computeStdDev(peaks->slope.right, cntPeak);
}

/* ------------------------------------------------------- */
/* -------------- Formant Tracker Classes ---------------- */
/*          @Authors: Scott Murakami, Tae Hong Park        */
/* ------------------------------------------------------- */

/* Peak Tracker */
PeakTracker::PeakTracker(){

    init            = false;
    initDisplayPtr  = false;

    // Create new structs
    formants       = new FORMANTS;
    formantsNew    = new FORMANTS_NEW;

    peaksAndValleys    = new PeaksAndValleys();
    peaksAndValleysLPF = new PeaksAndValleys();
};

PeakTracker::~PeakTracker(){
    delete [] formants->freq;
    delete [] formants->mag;
    delete [] nextFramePeaks->freq;
    delete [] nextFramePeaks->mag;
    delete [] formantsNew->freq;
    delete [] formantsNew->mag;

    delete [] peaksAndValleys->peaks->freq;
    delete [] peaksAndValleys->peaks->mag;
    delete [] peaksAndValleys->valleys->freq;
    delete [] peaksAndValleys->valleys->mag;

    delete [] peaksAndValleysLPF->peaks->freq;
    delete [] peaksAndValleysLPF->peaks->mag;
    delete [] peaksAndValleysLPF->valleys->freq;
    delete [] peaksAndValleysLPF->valleys->mag;

    delete formants;
    delete nextFramePeaks;
    delete formantsNew;
    delete topPeaksMag;

    delete peaksAndValleys;
    delete peaksAndValleysLPF;

    free(initZeros);
    free(initTrackerVal);
    free(tempF1Idx);
    free(lpfInBuf);
    free(lpfOutBuf);
};

void PeakTracker::initTracker(unsigned int bufferSize){

    trackingOn = false;
    firstFramePicked = false;
    stopAnalysisCounter = 0;

    formantNum = 0;

    deltaFLow  = 100;
    deltaFHigh = 100;

    indexLow  = -1;
    indexHigh = -1;

    nextPeakFreq = -1;
    nextPeakFreq = -1.0;


    lpfInBuf  = (float*)calloc(NUM_FILTER_COEFF, sizeof(float));
    lpfOutBuf = (float*)calloc(NUM_FILTER_COEFF, sizeof(float));
    for(int i=0; i<NUM_FILTER_COEFF; i++){
        lpfInBuf[i]  = 0.0;
        lpfOutBuf[i] = 0.0;
    }

    // Initialize all values to -1
    initTrackerVal = (float*) calloc(bufferSize, sizeof(float));
    initZeros = (float*) calloc(bufferSize, sizeof(float));
    for (int i = 0; i < bufferSize; i++){
        initTrackerVal[i] = -1.0;
        initZeros[i] = 0.0;
    }

    lpfGuideSignal = (float*) malloc(bufferSize*sizeof(float));
    memcpy(lpfGuideSignal, initZeros, bufferSize * sizeof(float));

    formants->freq = (float*) malloc(bufferSize * sizeof(float));
    formants->mag  = (float*) malloc(bufferSize * sizeof(float));
    memcpy(formants->freq, initTrackerVal, bufferSize * sizeof(float));
    memcpy(formants->mag, initTrackerVal, bufferSize * sizeof(float));

    formantsNew->freq = (float*) malloc(bufferSize * sizeof(float));
    formantsNew->mag  = (float*) malloc(bufferSize * sizeof(float));
    memcpy(formantsNew->freq, initTrackerVal, bufferSize * sizeof(float));
    memcpy(formantsNew->mag, initTrackerVal, bufferSize * sizeof(float));

    onsetThreshold  = 0.05;
    offsetThreshold = 0.05;
}

void PeakTracker::resetTracker(unsigned int bufferSize){

    firstFramePicked = false;
    stopAnalysisCounter = 0;

    formantNum = 0;

    deltaFLow  = 100;
    deltaFHigh = 100;

    indexLow  = -1;
    indexHigh = -1;

    nextPeakFreq = -1;
    nextPeakFreq = -1.0;

    memcpy(lpfGuideSignal, initZeros, bufferSize * sizeof(float));
    memcpy(formantsNew->mag, initTrackerVal, bufferSize * sizeof(float));
}

void PeakTracker::lpfFilter(float *signal, int signalLength){
    int bufLen = sizeof(lpfOutBuf) / sizeof(lpfOutBuf[0]);

    for(int i=0; i<signalLength; i++){
        lpfGuideSignal[i] = (bCoeff[i]*lpfInBuf[i]) + (bCoeff[i+1]*lpfInBuf[i+1]) + (bCoeff[i+2]*lpfInBuf[i+2]) + (aCoeff[i]*lpfOutBuf[i]) + (aCoeff[i+1]*lpfOutBuf[i+1]) + (aCoeff[i+2]*lpfOutBuf[i+2]);

        for(int j=bufLen-1; j>=0; j--){
            lpfOutBuf[j+1] = lpfOutBuf[j];
            lpfInBuf[j+1]  = lpfInBuf[j];
        }
        lpfOutBuf[0] = lpfGuideSignal[i];
    }
}

void PeakTracker::trackingOnOff(float *signal, int signalLength){
    // sum energy over signal
    float energy = 0.0;
    for (int i=0; i<signalLength; i++)
        energy += signal[i];

    // enable tracking when above onset threshold
    if (energy >= onsetThreshold)
        trackingOn = true;

    // turn off tracking when below offset threshold
    if(energy < offsetThreshold){
        if(trackingOn == true && stopAnalysisCounter < 10){
            stopAnalysisCounter += 1;
        }
        else if (stopAnalysisCounter >= 10){
            // turn tracking off
            trackingOn = false;
            stopAnalysisCounter = 0;
        }
    }
}

void PeakTracker::pickFirstFormantFrame(){
    int totalNumPeaks = sizeof(peaksAndValleys->peaks->freq)/sizeof(peaksAndValleys->peaks->freq[0]);
    int potentialF1Counter = 0;

    int tempF1Freq[totalNumPeaks];
    float tempF1HeightMin[totalNumPeaks];
    float tempF1HeightMax[totalNumPeaks];

    for (int i=0; i<totalNumPeaks; i++){
        /**
         1. If peaks are within range of the low passed peak (between the valleys on each side) then this is a potential F1
         2. Keep counter of potential F1s
        */

        if((peaksAndValleys->peaks->freq[i] > peaksAndValleysLPF->valleys->freq[0]) && (peaksAndValleys->peaks->freq[i] < peaksAndValleysLPF->valleys->freq[1])){

            tempF1Freq[potentialF1Counter]      = peaksAndValleys->peaks->freq[i];
            tempF1HeightMin[potentialF1Counter] = peaksAndValleys->peaks->height.min[i];
            tempF1HeightMax[potentialF1Counter] = peaksAndValleys->peaks->height.max[i];

            potentialF1Counter += 1;
        }
    }

    /**
     3. Choose from potential F1 candidates by selecting the most salient
     4. Sort all peaks in descending order
     5. Get the first formant location
     6. Pick the next three formants, making sure they are higher in frequency than the chosen first
     */

    // 3 - pick the most salient pick based on the largest min distance from adjacent valleys
    tempF1Idx = std::max_element(tempF1HeightMin, tempF1HeightMin+potentialF1Counter);
    long int F1Idx = std::distance(tempF1HeightMin, tempF1Idx);
    float F1Max    = peaksAndValleys->peaks->height.max[F1Idx];

    // 4 - sort
    // temp array of largest peaks
    topPeaksMag  = (float*) malloc(totalNumPeaks * sizeof(float));
    memcpy(topPeaksMag, peaksAndValleys->peaks->height.max, totalNumPeaks*sizeof(float));

    sort(topPeaksMag, topPeaksMag+totalNumPeaks, std::greater<int>());

    int formantIdx = 1;
    for(int i=0; i<totalNumPeaks; i++){
        for(int j=0; j<4; j++){
            // Pick F1
            if (F1Max == topPeaksMag[j] && formantIdx == 1){
                formants->freq[formantIdx] = peaksAndValleys->peaks->freq[F1Idx];
                formants->mag[formantIdx]  = peaksAndValleys->peaks->mag[F1Idx];
                formantIdx += 1;
            // Pick F2-F4. Pick the next largest peaks that aren't already chosen and are higher in frequency than the previous peaks
            } else if((peaksAndValleys->peaks->height.max[i] == topPeaksMag[j]) && peaksAndValleys->peaks->height.max[i] != peaksAndValleys->peaks->freq[F1Idx]){
                if (peaksAndValleys->peaks->freq[i] > formants->freq[formantIdx-1]){
                    formants->freq[formantIdx] = peaksAndValleys->peaks->freq[i];
                    formants->mag[formantIdx]  = peaksAndValleys->peaks->mag[i];
                }
            } else{
                if (formantIdx > 3){
                    break;
                }
            }
        }
    }
    firstFramePicked = true;
}

void PeakTracker::track(){

    int lenPeaks = sizeof(formants->freq) / sizeof(formants->freq[0]);

    for(int k = 0; k<NUM_FORMANTS; k++){
        formantsNew->freq[k] = -1;
        formantsNew->mag[k]  = -1;
    }

    /* Go through new peaks and determine which are the next four formants */
    for (formantNum = 1; formantNum<lenPeaks; formantNum++){
        indexLow   = -1;
        indexHigh  = -1;
        deltaFLow  = -1;
        deltaFHigh = -1;

        bool computed = true;

        switch (formantNum){
            case 0:
                checkHighAndLow(threshLow, threshHigh, formantNum);
                indexHigh = pickHigh(deltaFHigh);
                indexLow  = pickLow(deltaFLow);
                break;
            case 1:
                checkHighAndLow(threshLow, threshHigh, formantNum);
                indexHigh = pickHigh(deltaFHigh);
                indexLow  = pickLow(deltaFLow);
                break;
            case 2:
                checkHighAndLow(threshLow, threshHigh, formantNum);
                indexHigh = pickHigh(deltaFHigh);
                indexLow  = pickLow(deltaFLow);
                break;
            case 3:
                checkHighAndLow(threshLow, threshHigh, formantNum);
                indexHigh = pickHigh(deltaFHigh);
                indexLow  = pickLow(deltaFLow);
                break;
            default:
                computed = false;
                std::cout<<"no such formant number";
                break;
        }
        if(computed == true){
            pickNextFrameFormant();
        }
        formantsNew->freq[formantNum] = nextPeakFreq;
        formantsNew->mag[formantNum]  = nextPeakMag;
    }
}

void PeakTracker::pickNextFrameFormant(){
    if(indexHigh != -1 && indexLow != -1){
        pickBetweenTwo();
    } else if (indexHigh != -1){
        nextPeakFreq = peaksAndValleys->peaks->freq[indexHigh];
        nextPeakMag  = peaksAndValleys->peaks->mag[indexHigh];
    } else if (indexLow != -1){
        nextPeakFreq = peaksAndValleys->peaks->freq[indexLow];
        nextPeakMag  = peaksAndValleys->peaks->mag[indexLow];
    } else{
        skipAndRetain();
    }
}

int PeakTracker::pickHigh(float deltaFHigh){
    int index = -1;
    int numOfPeaks = sizeof(peaksAndValleys->peaks->freq)/sizeof(peaksAndValleys->peaks->freq[0]);
    int indexes[numOfPeaks];
    int numOfCandidates = 0;
    int startIdx = -1;

    for (int k = 0; k < numOfPeaks; k++){
        if((peaksAndValleys->peaks->freq[k] < formants->freq[formantNum] + deltaFHigh) && peaksAndValleys->peaks->freq[k] > formants->freq[formantNum]){
            numOfCandidates += 1;

            indexes[numOfCandidates] = k;
        }
    }

    if (numOfCandidates > 0){
        int temp = 0;
        int tempIndexes[numOfCandidates];
        int lenTemp = sizeof(tempIndexes) / sizeof(tempIndexes[0]);

        for (int kk = 0; kk < lenTemp; kk++){
            if (peaksAndValleys->peaks->height.max[kk] > temp){
                temp  = peaksAndValleys->peaks->height.max[kk];
                index = indexes[kk];
            } else{
                //skip
            }
        }
    }
    return index;
}

int PeakTracker::pickLow(float deltaFLow){
    int index = -1;
    int numOfPeaks = sizeof(peaksAndValleys->peaks->freq)/sizeof(peaksAndValleys->peaks->freq[0]);
    int indexes[numOfPeaks];
    int numOfCandidates = 0;
    int startIdx = -1;

    for (int k = 0; k < numOfPeaks; k++){
        if((peaksAndValleys->peaks->freq[k] > formants->freq[formantNum] - deltaFLow) && peaksAndValleys->peaks->freq[k] < formants->freq[formantNum]){
            numOfCandidates += 1;

            indexes[numOfCandidates] = k;
        }
    }

    if (numOfCandidates > 0){
        int temp = 0;
        int tempIndexes[numOfCandidates];
        int lenTemp = sizeof(tempIndexes) / sizeof(tempIndexes[0]);

        for (int kk = 0; kk < lenTemp; kk++){
            if (peaksAndValleys->peaks->height.max[kk] > temp){
                temp = peaksAndValleys->peaks->height.max[kk];
                index = indexes[kk];
            } else{
                //skip
            }
        }
    }
    return index;
}

void PeakTracker::checkHighAndLow(float threshLow, float threshHigh, int formantNum){
    checkLow(threshLow, formantNum);
    checkHigh(threshHigh, formantNum);
}

void PeakTracker::checkLow(float threshLow, int formantNum){
    if (formantNum == 0){
        deltaFLow = (formants->freq[formantNum] - 50) / 2;
        deltaFLow = deltaFLow - (deltaFLow*threshLow);
    } else {
        deltaFLow = (formants->freq[formantNum] - formants->freq[formantNum-1]) / 2;
        deltaFLow = deltaFLow - (deltaFLow*threshLow);
    }
}

void PeakTracker::checkHigh(float threshHigh, int formantNum){
    if (formantNum == 3){ //3 is actually 4
        // 4500 is the max freq of the analysis
        deltaFHigh = (MAX_DISPLAY_FREQ - formants->freq[formantNum]) / 2;
        deltaFHigh = deltaFHigh - (deltaFHigh*threshHigh);
    } else {
        deltaFHigh = (formants->freq[formantNum+1] - formants->freq[formantNum]) / 2;
        deltaFHigh = deltaFHigh - (deltaFHigh*threshHigh);
    }
}
