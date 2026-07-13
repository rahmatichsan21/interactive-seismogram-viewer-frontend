function Toolbar({
    onLoadWaveform,
}) {

    return (

        <div>

            <button
                onClick={onLoadWaveform}
            >
                Load Waveform
            </button>

        </div>

    );

}

export default Toolbar;