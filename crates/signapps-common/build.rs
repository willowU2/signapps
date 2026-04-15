use vergen::EmitBuilder;

fn main() {
    EmitBuilder::builder()
        .all_build()
        .all_git()
        .emit()
        .expect("vergen should emit env vars");
}
