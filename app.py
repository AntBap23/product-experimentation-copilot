import streamlit as st

from analysis_engine import DESIGN, FUNNEL_SQL, HYPOTHESIS, SCENARIOS, checkout_funnel
from readout_deck import export_readout


st.set_page_config(page_title="Product Experimentation Copilot", layout="wide")
st.title("Product Experimentation Copilot")
st.caption("Checkout analysis and A/B test readouts · Synthetic demo")

question = st.radio("Question", [
    "Where did checkout conversion change?",
    "What should we test?",
    "Is the experiment ready for a readout?",
], horizontal=True)

if question != "Is the experiment ready for a readout?":
    device = st.selectbox("Device", ["Mobile", "Desktop", "All devices"])
    prior, recent = checkout_funnel(device)
    change = (recent[3] / recent[1] - prior[3] / prior[1]) * 100
    st.metric("Checkout-to-purchase conversion", f"{recent[3] / recent[1]:.1%}", f"{change:+.1f} pp")
    chart_rows = [
        {"Step": step, "Week": row[0], "Sessions": count}
        for row in (prior, recent)
        for step, count in zip(("1. Checkout", "2. Payment", "3. Purchase"), row[1:])
    ]
    st.bar_chart(chart_rows, x="Step", y="Sessions", color="Week", stack=False)
    st.caption("Each period includes sessions that started checkout. Later steps must follow checkout in order.")
    with st.expander("Counts and SQL"):
        st.dataframe(chart_rows, hide_index=True)
        st.code(FUNNEL_SQL, language="sql")

    if question == "What should we test?":
        st.subheader("Mobile payment entry")
        st.write(HYPOTHESIS)
        for line in DESIGN:
            st.write(line)

else:
    scenario = st.selectbox("Experiment scenario", list(SCENARIOS))
    result = SCENARIOS[scenario]
    st.subheader(result.status)
    st.caption(f"Data through {result.as_of:%b %d, %Y} · Planned readout {result.planned_date:%b %d, %Y}")
    arms = [result.control, result.treatment]
    st.bar_chart(
        [{"Variant": arm.name, "Conversion (%)": 100 * arm.rate} for arm in arms],
        x="Variant", y="Conversion (%)",
    )
    st.dataframe([
        {"Variant": arm.name, "Assigned users": arm.assigned, "Purchasing users": arm.purchases}
        for arm in arms
    ], hide_index=True)
    st.write(f"Traffic split check p-value **{result.split_p_value:.3g}** · Alert threshold 0.01")
    if result.effect:
        effect, low, high = result.effect
        st.metric("Absolute lift", f"{effect * 100:+.2f} pp")
        st.write(f"95% confidence interval **{low * 100:+.2f} to {high * 100:+.2f} pp**")
    st.caption("Payment-error and refund outcomes are unavailable in this demo.")
    interpretation = st.text_area("Analyst interpretation and next steps", key=scenario, max_chars=420)
    st.download_button(
        "Download editable PowerPoint", export_readout(result, interpretation),
        file_name="checkout-readout.pptx",
        mime="application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )
